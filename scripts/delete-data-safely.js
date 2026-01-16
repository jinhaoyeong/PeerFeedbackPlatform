const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function deleteDataSafely() {
  console.log('🗑️  Safe Data Deletion Tool\n');
  console.log('=================================\n');

  const args = process.argv.slice(2);
  const [type, identifier] = args;

  if (!type || !identifier) {
    console.log('Usage: node delete-data-safely.js <type> <identifier>');
    console.log('\nTypes:');
    console.log('  user <email|userId>     - Delete a user and all related data');
    console.log('  group <name|groupId>   - Delete a group and all related data');
    console.log('  session <title|sessionId> - Delete a feedback session');
    console.log('  submissions <sessionId> - Delete all feedback submissions for a session');
    console.log('\nExamples:');
    console.log('  node delete-data-safely.js user qwert@gmail.com');
    console.log('  node delete-data-safely.js group Test Group');
    console.log('  node delete-data-safely.js session QAq');
    return;
  }

  try {
    switch (type.toLowerCase()) {
      case 'user':
        await deleteUser(identifier);
        break;
      case 'group':
        await deleteGroup(identifier);
        break;
      case 'session':
        await deleteSession(identifier);
        break;
      case 'submissions':
        await deleteSessionSubmissions(identifier);
        break;
      default:
        console.log('❌ Unknown type:', type);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteUser(identifier) {
  console.log(`🔍 Looking for user: ${identifier}`);

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: identifier },
        { username: identifier },
        { id: identifier }
      ]
    },
    include: {
      groupMemberships: true,
      feedbackSubmissions: true,
      createdGroups: true,
      Notification: true,
      _count: {
        select: {
          groupMemberships: true,
          feedbackSubmissions: true,
          createdGroups: true,
          Notification: true
        }
      }
    }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log(`👤 Found user: ${user.fullName} (${user.email})`);
  console.log(`   Group memberships: ${user._count.groupMemberships}`);
  console.log(`   Feedback submissions: ${user._count.feedbackSubmissions}`);
  console.log(`   Created groups: ${user._count.createdGroups}`);
  console.log(`   Notifications: ${user._count.Notification}`);

  // Delete in the correct order due to foreign key constraints
  console.log('\n🗑️  Deleting user and all related data...');

  // Delete notifications
  await prisma.notification.deleteMany({
    where: { userId: user.id }
  });
  console.log('   ✓ Notifications deleted');

  // Delete group memberships
  await prisma.groupMember.deleteMany({
    where: { userId: user.id }
  });
  console.log('   ✓ Group memberships deleted');

  // Delete feedback submissions where user is the target
  await prisma.feedbackSubmission.deleteMany({
    where: { targetUserId: user.id }
  });
  console.log('   ✓ Target feedback submissions deleted');

  // Delete feedback sessions created by this user (via groups they created)
  const userGroups = await prisma.group.findMany({
    where: { creatorId: user.id },
    select: { id: true }
  });

  for (const group of userGroups) {
    await prisma.feedbackSession.deleteMany({
      where: { groupId: group.id }
    });
  }
  console.log('   ✓ Feedback sessions deleted');

  // Delete groups created by this user
  await prisma.group.deleteMany({
    where: { creatorId: user.id }
  });
  console.log('   ✓ Created groups deleted');

  // Finally delete the user
  await prisma.user.delete({
    where: { id: user.id }
  });
  console.log('   ✓ User deleted successfully!');

  console.log('\n✅ User and all related data have been deleted.');
}

async function deleteGroup(identifier) {
  console.log(`🔍 Looking for group: ${identifier}`);

  const group = await prisma.group.findFirst({
    where: {
      OR: [
        { name: identifier },
        { joinCode: identifier },
        { id: identifier }
      ]
    },
    include: {
      _count: {
        select: {
          members: true,
          feedbackSessions: true
        }
      }
    }
  });

  if (!group) {
    console.log('❌ Group not found');
    return;
  }

  console.log(`🏢 Found group: ${group.name}`);
  console.log(`   Members: ${group._count.members}`);
  console.log(`   Feedback sessions: ${group._count.feedbackSessions}`);

  // Delete feedback sessions first
  await prisma.feedbackSession.deleteMany({
    where: { groupId: group.id }
  });
  console.log('   ✓ Feedback sessions deleted');

  // Delete group memberships
  await prisma.groupMember.deleteMany({
    where: { groupId: group.id }
  });
  console.log('   ✓ Group memberships deleted');

  // Delete the group
  await prisma.group.delete({
    where: { id: group.id }
  });
  console.log('   ✓ Group deleted successfully!');

  console.log('\n✅ Group and all related data have been deleted.');
}

async function deleteSession(identifier) {
  console.log(`🔍 Looking for feedback session: ${identifier}`);

  const session = await prisma.feedbackSession.findFirst({
    where: {
      OR: [
        { title: identifier },
        { id: identifier }
      ]
    },
    include: {
      _count: {
        select: {
          submissions: true
        }
      }
    }
  });

  if (!session) {
    console.log('❌ Feedback session not found');
    return;
  }

  console.log(`💬 Found session: ${session.title}`);
  console.log(`   Submissions: ${session._count.submissions}`);

  // Delete submissions first
  await prisma.feedbackSubmission.deleteMany({
    where: { sessionId: session.id }
  });
  console.log('   ✓ Feedback submissions deleted');

  // Delete the session
  await prisma.feedbackSession.delete({
    where: { id: session.id }
  });
  console.log('   ✓ Session deleted successfully!');

  console.log('\n✅ Feedback session and all submissions have been deleted.');
}

async function deleteSessionSubmissions(sessionId) {
  console.log(`🔍 Looking for session submissions: ${sessionId}`);

  const session = await prisma.feedbackSession.findFirst({
    where: {
      OR: [
        { title: sessionId },
        { id: sessionId }
      ]
    },
    include: {
      _count: {
        select: {
          submissions: true
        }
      }
    }
  });

  if (!session) {
    console.log('❌ Feedback session not found');
    return;
  }

  console.log(`💬 Found session: ${session.title}`);
  console.log(`   Submissions to delete: ${session._count.submissions}`);

  // Delete submissions
  const result = await prisma.feedbackSubmission.deleteMany({
    where: { sessionId: session.id }
  });
  console.log(`   ✓ ${result.count} feedback submissions deleted`);

  console.log('\n✅ All feedback submissions for the session have been deleted.');
}

deleteDataSafely();