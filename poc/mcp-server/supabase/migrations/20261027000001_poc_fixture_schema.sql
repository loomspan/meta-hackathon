-- POC fixture schema (synthetic data only). No credentials are stored anywhere in this fixture.
-- poc_tool_call_log intentionally has no token, secret, credential, or raw-argument columns.

CREATE TABLE poc_apps (
  id text PRIMARY KEY,
  name text NOT NULL,
  summary text NOT NULL,
  current_version integer NOT NULL CHECK (current_version > 0),
  environments text[] NOT NULL DEFAULT '{production}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE poc_app_definitions (
  app_id text NOT NULL REFERENCES poc_apps(id),
  version integer NOT NULL CHECK (version > 0),
  definition jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, version)
);

CREATE TABLE poc_packs (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('build', 'run', 'app')),
  app_id text REFERENCES poc_apps(id),
  version integer NOT NULL CHECK (version > 0),
  title text NOT NULL,
  instructions text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE poc_app_memberships (
  app_id text NOT NULL REFERENCES poc_apps(id),
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (app_id, user_id)
);

CREATE TABLE poc_grocery_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  app_id text NOT NULL REFERENCES poc_apps(id) DEFAULT 'grocery-list',
  name text NOT NULL CHECK (btrim(name) <> ''),
  quantity integer NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE poc_tool_call_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NULL,
  app_id text NULL,
  operation text NULL,
  app_version integer NULL,
  environment text NULL,
  outcome text NOT NULL CHECK (outcome IN ('ok', 'rejected', 'error')),
  error_code text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE poc_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_app_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_app_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_grocery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE poc_tool_call_log ENABLE ROW LEVEL SECURITY;
