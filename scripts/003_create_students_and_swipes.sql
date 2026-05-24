-- Create students table
CREATE TABLE IF NOT EXISTS students (
  uin VARCHAR(9) PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  room_number VARCHAR(4) NOT NULL, -- 3 digits + 1 letter
  meal_plan INTEGER NOT NULL CHECK (meal_plan IN (12, 14, 20)),
  weekly_credits INTEGER NOT NULL DEFAULT 0,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create meal_swipes table
CREATE TABLE IF NOT EXISTS meal_swipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_uin VARCHAR(9) NOT NULL REFERENCES students(uin),
  session_id UUID REFERENCES sessions(id),
  swiped_by UUID NOT NULL REFERENCES auth.users(id),
  swiped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  location VARCHAR(100),
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failed', 'insufficient_credits'))
);

-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_swipes ENABLE ROW LEVEL SECURITY;

-- RLS policies for students
CREATE POLICY "All authenticated users can view students" ON students
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin and staff can manage students" ON students
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'staff')
    )
  );

-- RLS policies for meal_swipes
CREATE POLICY "All authenticated users can view meal swipes" ON meal_swipes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "All authenticated users can create meal swipes" ON meal_swipes
  FOR INSERT TO authenticated WITH CHECK (swiped_by = auth.uid());

-- Insert sample students
INSERT INTO students (uin, first_name, last_name, room_number, meal_plan, weekly_credits, photo_url) VALUES
  ('123456789', 'John', 'Doe', '101A', 14, 14, '/placeholder.svg?height=150&width=150'),
  ('987654321', 'Jane', 'Smith', '205B', 20, 18, '/placeholder.svg?height=150&width=150'),
  ('456789123', 'Mike', 'Johnson', '312C', 12, 10, '/placeholder.svg?height=150&width=150'),
  ('789123456', 'Sarah', 'Wilson', '408D', 14, 12, '/placeholder.svg?height=150&width=150'),
  ('321654987', 'David', 'Brown', '156E', 20, 15, '/placeholder.svg?height=150&width=150');

-- Function to reset weekly credits (would be called by a cron job)
CREATE OR REPLACE FUNCTION reset_weekly_credits()
RETURNS void AS $$
BEGIN
  UPDATE students SET weekly_credits = meal_plan;
END;
$$ LANGUAGE plpgsql;
