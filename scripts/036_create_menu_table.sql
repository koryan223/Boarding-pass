-- Create menu table to store weekly meal menus
CREATE TABLE IF NOT EXISTS menus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week VARCHAR(10) NOT NULL CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')),
  meal_type VARCHAR(10) NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner')),
  menu_items TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  UNIQUE(day_of_week, meal_type)
);

-- Enable RLS
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view menus
CREATE POLICY "All authenticated users can view menus"
  ON menus FOR SELECT
  TO authenticated
  USING (true);

-- Admin and staff can manage menus
CREATE POLICY "Admin and staff can manage menus"
  ON menus FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE id = auth.uid()
      AND role IN ('admin', 'staff')
    )
  );

-- Insert default empty menu items for Mon-Fri, all 3 meals
INSERT INTO menus (day_of_week, meal_type, menu_items)
VALUES 
  ('Monday', 'Breakfast', ''),
  ('Monday', 'Lunch', ''),
  ('Monday', 'Dinner', ''),
  ('Tuesday', 'Breakfast', ''),
  ('Tuesday', 'Lunch', ''),
  ('Tuesday', 'Dinner', ''),
  ('Wednesday', 'Breakfast', ''),
  ('Wednesday', 'Lunch', ''),
  ('Wednesday', 'Dinner', ''),
  ('Thursday', 'Breakfast', ''),
  ('Thursday', 'Lunch', ''),
  ('Thursday', 'Dinner', ''),
  ('Friday', 'Breakfast', ''),
  ('Friday', 'Lunch', ''),
  ('Friday', 'Dinner', '')
ON CONFLICT (day_of_week, meal_type) DO NOTHING;
