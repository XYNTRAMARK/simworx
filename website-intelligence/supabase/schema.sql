-- Additive reports subsystem. Does not alter existing Simworx tables or functions.
-- Apply through Supabase's migration tool. All reporting access is server-side.
begin;

create table public.wi_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(btrim(email))),
  name text, company text, telephone text, country text,
  visitor_ids text[] not null default '{}',
  first_seen timestamptz not null, last_seen timestamptz not null,
  first_source text, latest_source text, first_campaign text, latest_campaign text,
  simulator_interest text,
  status text not null default 'NEW' check (status in ('NEW','ENGAGED','HIGH INTENT','CONTACTED','OPPORTUNITY','CUSTOMER','LOST')),
  notes text not null default '',
  marketing_consent boolean not null default false,
  consent_timestamp timestamptz, consent_text_version text, consent_source text,
  created_at timestamptz not null default now()
);
create table public.wi_visitors (
  id text primary key, first_seen timestamptz not null, last_seen timestamptz not null,
  first_source text not null default 'Direct', first_campaign text,
  lead_id uuid references public.wi_leads(id)
);
create table public.wi_sessions (
  id text primary key, visitor_id text not null references public.wi_visitors(id),
  start_time timestamptz not null, end_time timestamptz not null,
  landing_page text not null, exit_page text not null,
  source text not null default 'Direct', campaign text, country text, device text,
  converted boolean not null default false
);
create table public.wi_events (
  event_id text primary key,
  visitor_id text not null references public.wi_visitors(id),
  session_id text not null references public.wi_sessions(id),
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_]{0,79}$'),
  page_url text not null, timestamp timestamptz not null,
  properties jsonb not null default '{}'::jsonb check (jsonb_typeof(properties) = 'object'),
  received_at timestamptz not null default now()
);
create table public.wi_page_views (
  id text primary key references public.wi_events(event_id), visitor_id text not null references public.wi_visitors(id),
  session_id text not null references public.wi_sessions(id), url text not null,
  page_title text, timestamp timestamptz not null,
  engagement_time numeric not null default 0 check (engagement_time >= 0),
  scroll_depth numeric not null default 0 check (scroll_depth between 0 and 100)
);
create table public.wi_configurator_sessions (
  id text primary key, visitor_id text not null references public.wi_visitors(id),
  session_id text not null references public.wi_sessions(id), configurator_type text not null,
  configurator_version text not null default 'unknown', started_at timestamptz not null,
  completed_at timestamptz, last_step text not null, last_step_at timestamptz not null,
  simulator_category text, simulator_model text
);
create table public.wi_configurations (
  id text primary key, configurator_session_id text references public.wi_configurator_sessions(id),
  visitor_id text not null references public.wi_visitors(id), session_id text not null references public.wi_sessions(id),
  lead_id uuid references public.wi_leads(id), configurator_type text,
  simulator_category text, simulator_model text,
  configuration_json jsonb not null default '{}'::jsonb,
  estimated_price numeric check (estimated_price >= 0), currency text,
  emailed boolean not null default false, enquiry_status text not null default 'NONE',
  created_at timestamptz not null, attribution jsonb not null default '{}'::jsonb
);
create table public.wi_marketing_consents (
  id text primary key, lead_id uuid not null references public.wi_leads(id),
  consent boolean not null, timestamp timestamptz not null,
  source text not null, consent_text_version text, consent_text text
);
create table public.wi_attribution (
  id text primary key references public.wi_events(event_id),
  visitor_id text not null references public.wi_visitors(id), session_id text not null references public.wi_sessions(id),
  source text, medium text, campaign text, content text, term text, ref_code text, referrer_domain text,
  timestamp timestamptz not null
);
create table public.wi_admin_sessions (
  token_hash text primary key, created_at timestamptz not null default now(), expires_at timestamptz not null
);
create table public.wi_settings (
  id boolean primary key default true check (id), settings jsonb not null, updated_at timestamptz not null default now()
);
insert into public.wi_settings(id,settings) values(true,'{"scoring":{"product_page_viewed":5,"visual_systems_viewed":5,"configurator_opened":10,"simulator_selected":5,"configurator_five_minutes":5,"pricing_reached":15,"configuration_completed":15,"returned_another_day":10,"email_entered":20,"configuration_emailed":15,"enquiry_submitted":30},"alertsEnabled":false,"alertThresholds":{"trafficIncreasePct":50,"conversionDropPct":30,"highValue":100000},"retentionDays":null,"sessionTimeoutMinutes":30,"liveWindowMinutes":5,"timezone":"Europe/Paris"}'::jsonb);

create index wi_events_timestamp_idx on public.wi_events(timestamp);
create index wi_events_visitor_time_idx on public.wi_events(visitor_id,timestamp);
create index wi_events_session_time_idx on public.wi_events(session_id,timestamp);
create index wi_events_name_time_idx on public.wi_events(event_name,timestamp);
create index wi_visitors_lead_idx on public.wi_visitors(lead_id);
create index wi_sessions_visitor_idx on public.wi_sessions(visitor_id,start_time);
create index wi_sessions_end_idx on public.wi_sessions(end_time);
create index wi_page_views_session_idx on public.wi_page_views(session_id,timestamp);
create index wi_configurator_sessions_session_idx on public.wi_configurator_sessions(session_id);
create index wi_configurations_visitor_idx on public.wi_configurations(visitor_id,created_at);
create index wi_configurations_lead_idx on public.wi_configurations(lead_id);
create index wi_marketing_consents_lead_idx on public.wi_marketing_consents(lead_id,timestamp);
create index wi_attribution_session_idx on public.wi_attribution(session_id,timestamp);
create index wi_admin_sessions_expiry_idx on public.wi_admin_sessions(expires_at);

-- Remove contact details recursively before saving generic event/configuration facts.
-- Lead contacts live only in wi_leads; consent evidence lives in its dedicated table.
create function public.wi_redact_properties(value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path = '' as $$
declare result jsonb; k text; v jsonb;
begin
  if jsonb_typeof(value) = 'object' then
    result := '{}'::jsonb;
    for k,v in select * from jsonb_each(value) loop
      if lower(k) !~ '(email|e_mail|telephone|phone|password|token|authorization|address|contact|first_name|last_name|full_name|company|^name$)' then
        result := result || jsonb_build_object(k, public.wi_redact_properties(v));
      end if;
    end loop;
    return result;
  elsif jsonb_typeof(value) = 'array' then
    select coalesce(jsonb_agg(public.wi_redact_properties(x)), '[]'::jsonb) into result from jsonb_array_elements(value) x;
    return result;
  elsif jsonb_typeof(value) = 'string' and (value #>> '{}') ~* '[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}' then
    return '"[redacted]"'::jsonb;
  end if;
  return value;
end $$;

-- Single transaction: retries cannot duplicate leads, configurations, or consent facts.
-- Invoker privileges only; EXECUTE is granted solely to service_role below.
create function public.wi_ingest_events(p_events jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  e jsonb; p jsonb; safe_p jsonb; vid text; sid text; eid text; en text; page_path text;
  at_time timestamptz; src text; camp text; ct text; cv text; csid text; cfgid text;
  mail text; lid uuid; inserted_id text; accepted integer := 0; duplicate_count integer := 0;
  consent_value boolean; version_value text; consent_wording text; prior_session_visitor text;
  v_first timestamptz; v_source text; v_campaign text;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 50 then
    raise exception 'Invalid event batch';
  end if;
  for e in select value from jsonb_array_elements(p_events) order by value->>'timestamp',value->>'event_id' loop
    p := coalesce(e->'properties','{}'::jsonb);
    vid := e->>'visitor_id'; sid := e->>'session_id'; eid := e->>'event_id'; en := e->>'event_name';
    page_path := e->>'page_url'; at_time := (e->>'timestamp')::timestamptz;
    src := coalesce(nullif(p->>'source',''),'Direct');
    camp := coalesce(nullif(p->>'campaign',''),nullif(p->>'utm_campaign',''),nullif(p->>'ref_code',''));
    ct := nullif(p->>'configurator_type',''); cv := coalesce(nullif(p->>'configurator_version',''),'unknown');
    if page_path ~* '^/(reports|admin|portal)(/|$)' then continue; end if;
    -- A conflicting retry never changes existing event facts.
    if exists(select 1 from public.wi_events where event_id = eid) then duplicate_count := duplicate_count + 1; continue; end if;
    insert into public.wi_visitors(id,first_seen,last_seen,first_source,first_campaign)
      values(vid,at_time,at_time,src,camp)
      on conflict(id) do update set
        first_source = case when excluded.first_seen < public.wi_visitors.first_seen then excluded.first_source else public.wi_visitors.first_source end,
        first_campaign = case when excluded.first_seen < public.wi_visitors.first_seen then excluded.first_campaign else public.wi_visitors.first_campaign end,
        first_seen = least(public.wi_visitors.first_seen,excluded.first_seen),
        last_seen = greatest(public.wi_visitors.last_seen,excluded.last_seen);
    select visitor_id into prior_session_visitor from public.wi_sessions where id = sid;
    if prior_session_visitor is not null and prior_session_visitor <> vid then raise exception 'Session visitor mismatch'; end if;
    insert into public.wi_sessions(id,visitor_id,start_time,end_time,landing_page,exit_page,source,campaign,country,device)
      values(sid,vid,at_time,at_time,page_path,page_path,src,camp,nullif(p->>'country',''),nullif(p->>'device',''))
      on conflict(id) do update set
        landing_page = case when excluded.start_time < public.wi_sessions.start_time then excluded.landing_page else public.wi_sessions.landing_page end,
        source = case when excluded.start_time < public.wi_sessions.start_time then excluded.source else public.wi_sessions.source end,
        campaign = case when excluded.start_time < public.wi_sessions.start_time then excluded.campaign else public.wi_sessions.campaign end,
        exit_page = case when excluded.end_time >= public.wi_sessions.end_time then excluded.exit_page else public.wi_sessions.exit_page end,
        country = coalesce(excluded.country,public.wi_sessions.country), device = coalesce(excluded.device,public.wi_sessions.device),
        start_time = least(public.wi_sessions.start_time,excluded.start_time), end_time = greatest(public.wi_sessions.end_time,excluded.end_time)
      where public.wi_sessions.visitor_id = excluded.visitor_id;
    if exists(select 1 from public.wi_sessions where id = sid and visitor_id <> vid) then raise exception 'Session visitor mismatch'; end if;
    safe_p := public.wi_redact_properties(p);
    insert into public.wi_events(event_id,visitor_id,session_id,event_name,page_url,timestamp,properties)
      values(eid,vid,sid,en,page_path,at_time,safe_p) on conflict(event_id) do nothing returning event_id into inserted_id;
    if inserted_id is null then duplicate_count := duplicate_count + 1; continue; end if;
    accepted := accepted + 1;
    select lead_id,first_seen,first_source,first_campaign into lid,v_first,v_source,v_campaign from public.wi_visitors where id = vid;

    -- Contact details are accepted only on explicit voluntary identity/conversion events.
    mail := lower(btrim(coalesce(p->>'email',p#>>'{contact,email}','')));
    if en in ('identify','email_entered','enquiry_submitted','contact_form_submitted','newsletter_subscribed','marketing_consent_given','marketing_consent_withdrawn') and mail ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      insert into public.wi_leads(email,name,company,telephone,country,visitor_ids,first_seen,last_seen,first_source,latest_source,first_campaign,latest_campaign,simulator_interest)
        values(mail,nullif(coalesce(p->>'name',p#>>'{contact,name}'),''),nullif(coalesce(p->>'company',p#>>'{contact,company}'),''),nullif(coalesce(p->>'telephone',p#>>'{contact,telephone}'),''),nullif(p->>'country',''),array[vid],v_first,at_time,v_source,src,v_campaign,camp,nullif(p->>'simulator_category',''))
        on conflict(email) do update set
          name = coalesce(excluded.name,public.wi_leads.name), company = coalesce(excluded.company,public.wi_leads.company),
          telephone = coalesce(excluded.telephone,public.wi_leads.telephone), country = coalesce(excluded.country,public.wi_leads.country),
          visitor_ids = case when vid = any(public.wi_leads.visitor_ids) then public.wi_leads.visitor_ids else array_append(public.wi_leads.visitor_ids,vid) end,
          first_source = case when excluded.first_seen < public.wi_leads.first_seen then excluded.first_source else public.wi_leads.first_source end,
          first_campaign = case when excluded.first_seen < public.wi_leads.first_seen then excluded.first_campaign else public.wi_leads.first_campaign end,
          latest_source = case when excluded.last_seen >= public.wi_leads.last_seen then excluded.latest_source else public.wi_leads.latest_source end,
          latest_campaign = case when excluded.last_seen >= public.wi_leads.last_seen then excluded.latest_campaign else public.wi_leads.latest_campaign end,
          first_seen = least(public.wi_leads.first_seen,excluded.first_seen), last_seen = greatest(public.wi_leads.last_seen,excluded.last_seen),
          simulator_interest = coalesce(excluded.simulator_interest,public.wi_leads.simulator_interest)
        returning id into lid;
      update public.wi_visitors set lead_id = lid where id = vid;
      update public.wi_configurations set lead_id = lid where visitor_id = vid and lead_id is null;
    end if;
    if lid is not null then
      update public.wi_leads set
        latest_source = case when at_time >= last_seen then src else latest_source end,
        latest_campaign = case when at_time >= last_seen then camp else latest_campaign end,
        simulator_interest = case when at_time >= last_seen then coalesce(nullif(p->>'simulator_category',''),simulator_interest) else simulator_interest end,
        last_seen = greatest(last_seen,at_time)
        where id = lid;
      consent_value := null;
      if jsonb_typeof(p->'marketing_consent') = 'boolean' then consent_value := (p->>'marketing_consent')::boolean; end if;
      if en = 'marketing_consent_withdrawn' then consent_value := false; end if;
      version_value := nullif(p->>'consent_text_version','');
      consent_wording := nullif(p->>'consent_text','');
      -- An email delivery request alone never grants newsletter consent.
      if consent_value is not null and (not consent_value or (version_value is not null and consent_wording is not null)) then
        insert into public.wi_marketing_consents(id,lead_id,consent,timestamp,source,consent_text_version,consent_text)
          values(eid,lid,consent_value,at_time,page_path,version_value,consent_wording) on conflict(id) do nothing;
        update public.wi_leads set marketing_consent = consent_value,consent_timestamp = at_time,
          consent_text_version = version_value,consent_source = page_path
          where id = lid and (consent_timestamp is null or at_time >= consent_timestamp);
      end if;
    end if;

    if en = 'page_view' then
      insert into public.wi_page_views(id,visitor_id,session_id,url,page_title,timestamp)
        values(eid,vid,sid,page_path,left(p->>'page_title',300),at_time);
    elsif en in ('page_engagement','engagement','scroll_depth') then
      update public.wi_page_views set
        engagement_time = greatest(engagement_time,least(86400,greatest(0,coalesce((p->>'engagement_time')::numeric,(p->>'engagement_seconds')::numeric,0)))),
        scroll_depth = greatest(scroll_depth,least(100,greatest(0,coalesce((p->>'scroll_depth')::numeric,0))))
        where visitor_id = vid and session_id = sid and id = coalesce(nullif(p->>'page_view_id',''),(select id from public.wi_page_views where session_id = sid and url = page_path and timestamp <= at_time order by timestamp desc limit 1));
    end if;
    if en = 'session_started' then
      insert into public.wi_attribution(id,visitor_id,session_id,source,medium,campaign,content,term,ref_code,referrer_domain,timestamp)
        values(eid,vid,sid,src,p->>'utm_medium',camp,p->>'utm_content',p->>'utm_term',p->>'ref_code',p->>'referrer_domain',at_time);
    end if;
    if ct is not null then
      csid := coalesce(nullif(p->>'configurator_session_id',''),sid||':'||ct||':'||cv);
      insert into public.wi_configurator_sessions(id,visitor_id,session_id,configurator_type,configurator_version,started_at,last_step,last_step_at,simulator_category,simulator_model)
        values(csid,vid,sid,ct,cv,at_time,en,at_time,nullif(p->>'simulator_category',''),nullif(p->>'simulator_model',''))
        on conflict(id) do update set
          last_step = case when excluded.last_step_at >= public.wi_configurator_sessions.last_step_at then excluded.last_step else public.wi_configurator_sessions.last_step end,
          last_step_at = greatest(public.wi_configurator_sessions.last_step_at,excluded.last_step_at),
          started_at = least(public.wi_configurator_sessions.started_at,excluded.started_at),
          simulator_category = coalesce(excluded.simulator_category,public.wi_configurator_sessions.simulator_category),
          simulator_model = coalesce(excluded.simulator_model,public.wi_configurator_sessions.simulator_model)
        where public.wi_configurator_sessions.visitor_id = excluded.visitor_id and public.wi_configurator_sessions.session_id = excluded.session_id
          and public.wi_configurator_sessions.configurator_type = excluded.configurator_type and public.wi_configurator_sessions.configurator_version = excluded.configurator_version;
      if exists(select 1 from public.wi_configurator_sessions where id = csid and (visitor_id <> vid or session_id <> sid or configurator_type <> ct or configurator_version <> cv)) then raise exception 'Configurator session mismatch'; end if;
      cfgid := coalesce(nullif(p->>'configuration_id',''),eid);
      if en in ('configuration_completed','projection_configuration_completed','led_configuration_completed') then
        update public.wi_configurator_sessions set completed_at = coalesce(completed_at,at_time) where id = csid;
        insert into public.wi_configurations(id,configurator_session_id,visitor_id,session_id,lead_id,configurator_type,simulator_category,simulator_model,configuration_json,estimated_price,currency,created_at,attribution)
          values(cfgid,csid,vid,sid,lid,ct,nullif(p->>'simulator_category',''),nullif(p->>'simulator_model',''),coalesce(safe_p->'configuration_json',safe_p->'configuration',safe_p),
            case when (p->>'estimated_price') ~ '^\d+(\.\d+)?$' then (p->>'estimated_price')::numeric else null end,
            case when (p->>'currency') ~ '^[A-Z]{3}$' then p->>'currency' else null end,at_time,
            jsonb_build_object('source',src,'campaign',camp,'ref_code',p->>'ref_code','utm_source',p->>'utm_source','utm_medium',p->>'utm_medium'))
          on conflict(id) do nothing;
      end if;
      if en = 'configuration_emailed' and nullif(p->>'configuration_id','') is not null then
        update public.wi_configurations set emailed = true where id = p->>'configuration_id' and visitor_id = vid;
      end if;
      if en in ('enquiry_submitted','contact_form_submitted') then
        update public.wi_configurations set enquiry_status = 'SUBMITTED' where visitor_id = vid and (id = p->>'configuration_id' or (p->>'configuration_id' is null and session_id = sid));
      end if;
    end if;
    if en in ('configuration_completed','led_configuration_completed','projection_configuration_completed','email_entered','configuration_emailed','enquiry_submitted','contact_form_submitted') then
      update public.wi_sessions set converted = true where id = sid;
    end if;
  end loop;
  return jsonb_build_object('accepted',accepted,'duplicates',duplicate_count);
end $$;

-- Reports tables cannot be queried by either public browser role.
do $$ declare t text; begin
  foreach t in array array['wi_leads','wi_visitors','wi_sessions','wi_events','wi_page_views','wi_configurator_sessions','wi_configurations','wi_marketing_consents','wi_attribution','wi_admin_sessions','wi_settings'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on table public.%I from public, anon, authenticated',t);
    execute format('grant select, insert, update, delete on table public.%I to service_role',t);
  end loop;
end $$;
revoke all on function public.wi_redact_properties(jsonb) from public, anon, authenticated;
revoke all on function public.wi_ingest_events(jsonb) from public, anon, authenticated;
grant execute on function public.wi_redact_properties(jsonb) to service_role;
grant execute on function public.wi_ingest_events(jsonb) to service_role;
commit;
