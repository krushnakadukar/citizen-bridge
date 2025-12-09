-- Drop and recreate the handle_new_user function to properly use metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  new_profile_id UUID;
BEGIN
  INSERT INTO public.profiles (auth_user_id, email, full_name, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.raw_user_meta_data ->> 'phone'
  )
  RETURNING id INTO new_profile_id;
  
  -- Assign default citizen role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new_profile_id, 'citizen');
  
  RETURN NEW;
END;
$$;