-- Once-per-JST-day successful Discord reminders, independent of application data.
-- statement
CREATE TABLE pending_application_reminder_deliveries (
  send_date DATE PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
