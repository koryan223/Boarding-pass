-- Create session_resumes table to track when users rejoin a session
CREATE TABLE IF NOT EXISTS session_resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  resumed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE session_resumes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view resumes for their sessions" ON session_resumes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions 
      WHERE sessions.id = session_resumes.session_id 
      AND sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create resumes for their sessions" ON session_resumes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS session_resumes_session_id_idx ON session_resumes(session_id);
CREATE INDEX IF NOT EXISTS session_resumes_resumed_at_idx ON session_resumes(resumed_at);
