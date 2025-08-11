import 'dotenv/config';
import { getDb, isPostgresMode, closeDb } from '../server/db';
import { tasks, taskEstimates } from '../shared/schema';

async function main() {
  try {
    if (!isPostgresMode()) {
      console.log('Seeding skipped: STORAGE_BACKEND is not postgres or DATABASE_URL is missing.');
      return;
    }

    if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    const db = getDb();

    // Simple representative demo tasks
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const demoTasks = [
      {
        title: 'Team standup meeting',
        description: 'Daily team sync',
        notes: null,
        startTime: new Date(todayStart.getTime() + 9 * 60 * 60 * 1000),
        endTime: new Date(todayStart.getTime() + 9.5 * 60 * 60 * 1000),
        completed: true,
        priority: 'medium' as const,
      },
      {
        title: 'Design review meeting',
        description: 'Review UI/UX designs',
        notes: null,
        startTime: new Date(todayStart.getTime() + 10 * 60 * 60 * 1000),
        endTime: new Date(todayStart.getTime() + 11 * 60 * 60 * 1000),
        completed: true,
        priority: 'medium' as const,
      },
      {
        title: 'Working on calendar app mockup',
        description: 'Create the calendar interface',
        notes: 'Focus on responsive design and UX',
        startTime: new Date(todayStart.getTime() + 13 * 60 * 60 * 1000),
        endTime: new Date(todayStart.getTime() + 16 * 60 * 60 * 1000),
        completed: false,
        priority: 'high' as const,
      },
    ];

    console.log('Inserting demo tasks...');
    const inserted = await db.insert(tasks).values(demoTasks).returning();

    console.log(`Inserted ${inserted.length} tasks.`);

    if (inserted.length > 0) {
      console.log('Inserting example estimates...');
      const estimates = inserted.slice(0, 2).map((t) => ({
        taskId: t.id,
        estimatedDurationMinutes: 60,
      }));
      await db.insert(taskEstimates).values(estimates);
    }

    console.log('Seed completed.');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();


