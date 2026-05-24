-- Add a sample student with UIN 123456789 for testing
INSERT INTO students (uin, first_name, last_name, room_number, meal_plan, weekly_credits, photo_url)
VALUES ('123456789', 'John', 'Doe', '101A', 14, 10, null)
ON CONFLICT (uin) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  room_number = EXCLUDED.room_number,
  meal_plan = EXCLUDED.meal_plan,
  weekly_credits = EXCLUDED.weekly_credits;

-- Add another sample student with 0 credits to test insufficient credit scenario
INSERT INTO students (uin, first_name, last_name, room_number, meal_plan, weekly_credits, photo_url)
VALUES ('987654321', 'Jane', 'Smith', '205B', 12, 0, null)
ON CONFLICT (uin) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  room_number = EXCLUDED.room_number,
  meal_plan = EXCLUDED.meal_plan,
  weekly_credits = EXCLUDED.weekly_credits;
