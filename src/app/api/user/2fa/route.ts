import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import jwt from 'jsonwebtoken'
import { authenticator } from 'otplib'
import * as QRCode from 'qrcode'
import { encrypt, decrypt, hash } from '@/lib/crypto'
import { NotificationService } from '@/lib/notifications'
import { AuthService } from '@/lib/auth-service'

function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.substring(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    return decoded
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId }
    }) as any

    return NextResponse.json({
      status: {
        enabled: !!(dbUser as any)?.twoFAEnabled,
      }
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get 2FA status' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getUserFromToken(request)
    if (!user?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const action = body.action as string

    if (action === 'init') {
      const secret = authenticator.generateSecret()
      const label = body.label || user.email || user.userId
      const otpauth = authenticator.keyuri(label, 'Peer Feedback Platform', secret)
      const qr = await QRCode.toDataURL(otpauth)

      await prisma.user.update({
        where: { id: user.userId },
        data: {
          twoFASecretTempEnc: encrypt(secret),
        } as any
      })

      return NextResponse.json({ otpauth, qr })
    }

    if (action === 'verify') {
      const code = String(body.code || '')
      const record = await prisma.user.findUnique({
        where: { id: user.userId }
      }) as any
      const tempEnc = record?.twoFASecretTempEnc
      if (!tempEnc) {
        return NextResponse.json({ error: '2FA setup not initialized' }, { status: 400 })
      }
      const secret = decrypt(tempEnc)
      const valid = authenticator.check(code, secret)
      if (!valid) {
        return NextResponse.json({ error: 'Invalid verification code' }, { status: 400 })
      }

      const backupCodes = Array.from({ length: 8 }).map(() => Math.random().toString().slice(2, 8))
      const backupCodesHash = backupCodes.map(c => hash(c)).join(',')

      await prisma.user.update({
        where: { id: user.userId },
        data: {
          twoFASecretEnc: encrypt(secret as string),
          twoFAEnabled: true,
          twoFASecretTempEnc: null,
          twoFARecoveryCodesEnc: encrypt(backupCodesHash),
        } as any
      })

      return NextResponse.json({ success: true, backupCodes })
    }

    if (action === 'disable') {
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          twoFAEnabled: false,
          twoFASecretEnc: null,
          twoFARecoveryCodesEnc: null,
          twoFASecretTempEnc: null,
        } as any
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'fallback') {
      const method = (body.method as 'email' | 'sms') || 'email'
      if (method === 'sms') {
        return NextResponse.json({ error: 'SMS fallback not configured' }, { status: 501 })
      }
      const code = Math.floor(100000 + Math.random() * 900000).toString()
      const expires = new Date(Date.now() + 10 * 60 * 1000)
      await prisma.user.update({
        where: { id: user.userId },
        data: {
          twoFAFallbackCodeHash: hash(code),
          twoFAFallbackCodeExpiresAt: expires,
          twoFAFallbackMethod: method,
        } as any
      })
      try {
        await NotificationService.sendEmail(
          user.userId,
          'Your 2FA verification code',
          `Use this code to verify login: ${code}`,
          `<p>Use this code to verify login:</p><h2>${code}</h2><p>This code expires at ${expires.toLocaleString()}.</p>`
        )
        return NextResponse.json({ success: true })
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          return NextResponse.json({ success: true, devCode: code })
        }
        return NextResponse.json({ error: 'Email delivery failed' }, { status: 500 })
      }
    }

    if (action === 'verify-fallback') {
      const code = String(body.code || '')
      const record = await prisma.user.findUnique({
        where: { id: user.userId }
      }) as any
      const hashStored = record?.twoFAFallbackCodeHash
      const expires = record?.twoFAFallbackCodeExpiresAt
      if (!hashStored || !expires) {
        return NextResponse.json({ error: 'No fallback code pending' }, { status: 400 })
      }
      if (new Date(expires).getTime() < Date.now()) {
        return NextResponse.json({ error: 'Code expired' }, { status: 400 })
      }
      if (hash(code) !== hashStored) {
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      }
      await prisma.user.update({
        where: { id: user.userId },
        data: { twoFAFallbackCodeHash: null, twoFAFallbackCodeExpiresAt: null } as any
      })
      const fullToken = AuthService.generateToken(user.userId)
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } }) as any
      const response = NextResponse.json({
        success: true,
        token: fullToken,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          fullName: dbUser.fullName
        }
      })
      response.cookies.set('auth-token', fullToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60
      })
      return response
    }

    if (action === 'login-verify') {
      const code = String(body.code || '')
      const record = await prisma.user.findUnique({ where: { id: user.userId } }) as any
      const enc = record?.twoFASecretEnc
      if (!enc) {
        return NextResponse.json({ error: '2FA not enabled' }, { status: 400 })
      }
      const secret = decrypt(enc)
      const ok = authenticator.check(code, secret)
      if (!ok) {
        return NextResponse.json({ error: 'Invalid code' }, { status: 400 })
      }
      const fullToken = AuthService.generateToken(user.userId)
      const dbUser = await prisma.user.findUnique({ where: { id: user.userId } }) as any
      const response = NextResponse.json({
        success: true,
        token: fullToken,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          username: dbUser.username,
          fullName: dbUser.fullName
        }
      })
      response.cookies.set('auth-token', fullToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60
      })
      return response
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: '2FA operation failed' }, { status: 500 })
  }
}
