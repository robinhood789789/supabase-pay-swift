-- Enable realtime for profiles table
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- Enable realtime for memberships table
ALTER TABLE public.memberships REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.memberships;