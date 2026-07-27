delete from public.quote_requests where email = 'test-devis@example.com';
delete from public.appointments where email = 'test-rdv@example.com';
delete from public.contact_requests where email like 'test%@example.com';