-- contact_requests
DROP POLICY IF EXISTS "Anyone can submit a contact request" ON public.contact_requests;
CREATE POLICY "Anyone can submit a contact request"
ON public.contact_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(name) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(message) BETWEEN 1 AND 5000
  AND (phone IS NULL OR length(phone) <= 40)
  AND (subject IS NULL OR length(subject) <= 200)
);

-- quote_requests
DROP POLICY IF EXISTS "Anyone can submit a quote request" ON public.quote_requests;
CREATE POLICY "Anyone can submit a quote request"
ON public.quote_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(name) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(phone) BETWEEN 1 AND 40
  AND length(service_type) BETWEEN 1 AND 200
  AND length(description) BETWEEN 1 AND 5000
  AND (address IS NULL OR length(address) <= 500)
  AND (urgency IS NULL OR length(urgency) <= 100)
);

-- appointments
DROP POLICY IF EXISTS "Anyone can request an appointment" ON public.appointments;
CREATE POLICY "Anyone can request an appointment"
ON public.appointments
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(name) BETWEEN 1 AND 200
  AND length(email) BETWEEN 3 AND 320
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND length(phone) BETWEEN 1 AND 40
  AND length(service_type) BETWEEN 1 AND 200
  AND preferred_date >= CURRENT_DATE
  AND length(time_slot) BETWEEN 1 AND 100
  AND (notes IS NULL OR length(notes) <= 5000)
);