-- Enable pgvector extension for RAG
create extension if not exists vector;

-- Conversations table
create table conversations (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);

create index idx_conversations_session on conversations(session_id);
create index idx_conversations_created on conversations(created_at);

-- Memory/Facts table
create table facts (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  key text not null,
  value text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(category, key)
);

-- Documents for RAG (vector embeddings)
create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  metadata jsonb default '{}',
  embedding vector(1536),  -- OpenAI ada-002 embedding size
  created_at timestamptz default now()
);

create index idx_documents_embedding on documents using ivfflat (embedding vector_cosine_ops);

-- Persona settings
create table persona (
  id uuid primary key default gen_random_uuid(),
  name text default 'Chloe',
  description text,
  personality jsonb default '{"tone": "friendly", "humor": "moderate", "verbosity": "balanced"}',
  background jsonb default '{"occupation": "", "expertise": [], "interests": []}',
  communication jsonb default '{"honorific": "polite", "language": "ko"}',
  updated_at timestamptz default now()
);

-- Insert default persona
insert into persona (name, description) values ('Chloe', 'AI 도플갱어');

-- Email signups
create table email_signups (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  created_at timestamptz default now()
);

-- Calendar events cache
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  google_event_id text unique,
  title text,
  start_time timestamptz,
  end_time timestamptz,
  attendee_email text,
  created_at timestamptz default now()
);

-- Function to search similar documents
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where 1 - (d.embedding <=> query_embedding) > match_threshold
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
