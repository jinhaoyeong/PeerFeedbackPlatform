const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function inspectDatabase() {
  console.log('🔍 Database Inspection Report\n');
  console.log('=====================================\n');

  try {
    // Check User table
    console.log('👥 USERS:');
    const users = await prisma.user.findMany();
    if (users.length === 0) {
      console.log('  ❌ No users found');
    } else {
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ID: ${user.id}`);
        console.log(`     Email: ${user.email}`);
        console.log(`     Username: ${user.username}`);
        console.log(`     Full Name: ${user.fullName}`);
        console.log(`     Created: ${user.createdAt}`);
        console.log(`     Last Login: ${user.lastLoginAt || 'Never'}`);
        console.log(`     2FA Enabled: ${user.twoFactorEnabled ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    console.log('\n🏢 GROUPS:');
    const groups = await prisma.group.findMany();
    if (groups.length === 0) {
      console.log('  ❌ No groups found');
    } else {
      groups.forEach((group, index) => {
        console.log(`  ${index + 1}. ID: ${group.id}`);
        console.log(`     Name: ${group.name}`);
        console.log(`     Description: ${group.description || 'None'}`);
        console.log(`     Created: ${group.createdAt}`);
        console.log(`     Active: ${group.isActive ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    console.log('\n🤝 GROUP MEMBERS:');
    const members = await prisma.groupMember.findMany({
      include: {
        user: true,
        group: true
      }
    });
    if (members.length === 0) {
      console.log('  ❌ No group members found');
    } else {
      members.forEach((member, index) => {
        console.log(`  ${index + 1}. User: ${member.user.username} (${member.user.email})`);
        console.log(`     Group: ${member.group.name}`);
        console.log(`     Role: ${member.role}`);
        console.log(`     Can Give Feedback: ${member.canGiveFeedback ? 'Yes' : 'No'}`);
        console.log(`     Can Receive Feedback: ${member.canReceiveFeedback ? 'Yes' : 'No'}`);
        console.log(`     Joined: ${member.createdAt}`);
        console.log('');
      });
    }

    console.log('\n💬 FEEDBACK SESSIONS:');
    const sessions = await prisma.feedbackSession.findMany({
      include: {
        group: true,
        _count: {
          select: { submissions: true }
        }
      }
    });
    if (sessions.length === 0) {
      console.log('  ❌ No feedback sessions found');
    } else {
      sessions.forEach((session, index) => {
        console.log(`  ${index + 1}. ID: ${session.id}`);
        console.log(`     Title: ${session.title}`);
        console.log(`     Group: ${session.group.name}`);
        console.log(`     Status: ${session.status}`);
        console.log(`     Submissions: ${session._count.submissions}`);
        console.log(`     Created: ${session.createdAt}`);
        console.log('');
      });
    }

    console.log('\n📝 FEEDBACK SUBMISSIONS:');
    const submissions = await prisma.feedbackSubmission.findMany({
      include: {
        targetUser: true,
        session: true
      }
    });
    if (submissions.length === 0) {
      console.log('  ❌ No feedback submissions found');
    } else {
      submissions.forEach((sub, index) => {
        console.log(`  ${index + 1}. ID: ${sub.id}`);
        console.log(`     Target: ${sub.targetUser.username} (${sub.targetUser.email})`);
        console.log(`     Session: ${sub.session.title}`);
        console.log(`     Sentiment: ${sub.sentiment || 'Not analyzed'}`);
        console.log(`     Flagged: ${sub.isFlagged ? 'Yes' : 'No'}`);
        console.log(`     Submitted: ${sub.submittedAt}`);
        console.log(`     Content: ${sub.content.substring(0, 100)}...`);
        console.log('');
      });
    }

    console.log('\n📊 SUMMARY:');
    console.log(`  Users: ${users.length}`);
    console.log(`  Groups: ${groups.length}`);
    console.log(`  Group Members: ${members.length}`);
    console.log(`  Feedback Sessions: ${sessions.length}`);
    console.log(`  Feedback Submissions: ${submissions.length}`);

  } catch (error) {
    console.error('❌ Error inspecting database:', error.message);
    console.error('   Make sure the database is initialized by running: npm run db:push');
  } finally {
    await prisma.$disconnect();
  }
}

inspectDatabase();