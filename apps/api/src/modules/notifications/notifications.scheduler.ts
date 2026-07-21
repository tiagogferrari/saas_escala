import type { FastifyInstance } from "fastify";
import { sendDueScheduleReminders } from "./notifications.service";

const reminderIntervalMs = 15 * 60 * 1000;

export function startNotificationScheduler(app: FastifyInstance) {
  const dispatchReminders = async () => {
    try {
      await sendDueScheduleReminders();
    } catch (error) {
      app.log.error(error, "Unable to dispatch schedule reminders");
    }
  };

  const initialRun = setTimeout(() => {
    void dispatchReminders();
  }, 5_000);
  const interval = setInterval(() => {
    void dispatchReminders();
  }, reminderIntervalMs);

  app.addHook("onClose", async () => {
    clearTimeout(initialRun);
    clearInterval(interval);
  });
}
