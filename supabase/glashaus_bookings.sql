-- Direct bookings for glashausresort.com. Run once in the Supabase SQL editor (or as a migration).
create extension if not exists btree_gist;

create table if not exists public.glashaus_bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  check_in date not null,
  check_out date not null,
  guests int not null check (guests between 1 and 2),
  status text not null check (status in ('pending','paid','expired','cancelled','refunded')),
  expires_at timestamptz,
  paid_at timestamptz,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  guest_note text,
  nights int not null,
  lodging numeric(10,2) not null,
  cleaning numeric(10,2) not null,
  tax numeric(10,2) not null,
  total numeric(10,2) not null,
  source text not null default 'direct',
  stripe_session_id text unique,
  stripe_payment_intent text,
  check (check_out > check_in)
);

-- No two live stays (paid, or held during checkout) can overlap. Check-out day may equal the next check-in.
alter table public.glashaus_bookings drop constraint if exists glashaus_no_overlap;
alter table public.glashaus_bookings add constraint glashaus_no_overlap
  exclude using gist (daterange(check_in, check_out, '[)') with &&)
  where (status in ('pending','paid'));

create index if not exists glashaus_bookings_dates on public.glashaus_bookings (check_in, check_out);

-- Only the server (service-role key) touches this table. No public access.
alter table public.glashaus_bookings enable row level security;
