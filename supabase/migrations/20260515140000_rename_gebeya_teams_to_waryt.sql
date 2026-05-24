-- Rename legacy seed team labels from Gebeya → Waryt (display names only; IDs unchanged).
update public.teams
set name = 'Waryt Growth'
where name = 'Gebeya Growth' or lower(name) = 'gebeya growth';

update public.teams
set name = 'Waryt Enterprise'
where name = 'Gebeya Enterprise' or lower(name) = 'gebeya enterprise';

update public.teams
set name = replace(name, 'Gebeya', 'Waryt')
where name ilike '%gebeya%';
