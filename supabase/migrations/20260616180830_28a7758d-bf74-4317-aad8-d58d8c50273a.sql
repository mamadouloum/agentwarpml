
CREATE OR REPLACE FUNCTION public.find_user_by_email(_email text)
RETURNS TABLE (id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only school admins or super admins may resolve a user id by email
  IF NOT (
    public.has_role(auth.uid(), 'super_admin')
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'school_admin')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY SELECT u.id FROM auth.users u WHERE lower(u.email) = lower(_email) LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;
