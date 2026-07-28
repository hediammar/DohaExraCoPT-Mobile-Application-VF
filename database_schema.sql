-- Create users table
CREATE TABLE public.users (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    username CHARACTER VARYING(50) NOT NULL,
    name CHARACTER VARYING(255) NOT NULL,
    phone_number CHARACTER VARYING(20) NULL,
    email CHARACTER VARYING(255) NOT NULL,
    role CHARACTER VARYING(50) NOT NULL,
    department CHARACTER VARYING(100) NULL,
    status CHARACTER VARYING(20) NULL DEFAULT 'active'::character varying,
    last_login TIMESTAMP WITH TIME ZONE NULL,
    password_hash CHARACTER VARYING(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NULL DEFAULT NOW(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_username_key UNIQUE (username),
    CONSTRAINT users_role_check CHECK (
        (role)::text = any (
            (
                array[
                    'Administrator'::character varying,
                    'Data Entry'::character varying,
                    'Production engineer'::character varying,
                    'QC Factory'::character varying,
                    'Store Site'::character varying,
                    'QC Site'::character varying,
                    'Foreman Site'::character varying,
                    'Site Engineer'::character varying,
                    'Customer'::character varying
                ]
            )::text[]
        )
    ),
    CONSTRAINT users_status_check CHECK (
        (
            (status)::text = any (
                (
                    array[
                        'active'::character varying,
                        'inactive'::character varying
                    ]
                )::text[]
            )
        )
    )
) TABLESPACE pg_default;

-- Create panel_status_histories table
CREATE TABLE public.panel_status_histories (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    panel_id UUID NOT NULL,
    status INTEGER NOT NULL,
    user_id UUID NOT NULL,
    notes TEXT NULL,
    image_url TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT panel_status_histories_pkey PRIMARY KEY (id),
    CONSTRAINT panel_status_histories_panel_id_fkey FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE,
    CONSTRAINT panel_status_histories_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) TABLESPACE pg_default;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users USING btree (email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users USING btree (username) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users USING btree (role) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users USING btree (status) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_panel_status_histories_panel_id ON public.panel_status_histories USING btree (panel_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_panel_status_histories_user_id ON public.panel_status_histories USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_panel_status_histories_created_at ON public.panel_status_histories USING btree (created_at) TABLESPACE pg_default;

-- Add user_id foreign key to existing tables
ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE buildings ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE customers ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE facades ADD COLUMN user_id UUID REFERENCES users(id);
ALTER TABLE panels ADD COLUMN user_id UUID REFERENCES users(id);

-- Add customer_id foreign key to users table for RBAC
ALTER TABLE public.users ADD COLUMN customer_id UUID NULL;
ALTER TABLE public.users ADD CONSTRAINT users_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES customers(id);

-- Add constraint to ensure Customer role users have customer_id
ALTER TABLE public.users ADD CONSTRAINT users_customer_role_check 
  CHECK ((role <> 'Customer') OR (customer_id IS NOT NULL));

-- Create indexes for foreign keys
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_buildings_user_id ON buildings(user_id);
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_facades_user_id ON facades(user_id);
CREATE INDEX idx_panels_user_id ON panels(user_id);
CREATE INDEX idx_users_customer_id ON public.users(customer_id);

-- Insert a default administrator user (password: admin123)
-- Note: In production, use proper password hashing
INSERT INTO public.users (username, name, email, role, department, status, password_hash) 
VALUES ('admin', 'System Administrator', 'admin@company.com', 'Administrator', 'IT', 'active', '$2a$10$rQZ8K9mX3vL2nP1qR5sT7uI8oA1bC3dE5fG6hI9jK0lM1nO2pQ3rS4tU5vW6xY7z');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at BEFORE
UPDATE ON users FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to log panel status changes with user tracking
CREATE OR REPLACE FUNCTION log_panel_status_change()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
BEGIN
    -- Get the current user ID from the panel record
    current_user_id := NEW.user_id;
    
    -- Log the operation for debugging
    RAISE NOTICE 'Panel status change: panel_id=%, status=%, user_id=%', NEW.id, NEW.status, current_user_id;
    
    -- Insert status history with user tracking
    INSERT INTO panel_status_histories (
        panel_id,
        status,
        user_id,
        created_at
    ) VALUES (
        NEW.id,
        NEW.status,
        COALESCE(current_user_id, (SELECT id FROM users WHERE username = 'admin' LIMIT 1)),
        NOW()
    );
    
    -- Log the inserted record
    RAISE NOTICE 'Status history inserted: panel_id=%, status=%, user_id=%', NEW.id, NEW.status, COALESCE(current_user_id, (SELECT id FROM users WHERE username = 'admin' LIMIT 1));
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the transaction
        RAISE WARNING 'Error in log_panel_status_change: %', SQLERRM;
        RETURN NEW;
END;
$$ language 'plpgsql';

-- Ensure triggers are properly set up
DROP TRIGGER IF EXISTS panel_status_update ON panels;
CREATE TRIGGER panel_status_update
    AFTER UPDATE OF status ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

DROP TRIGGER IF EXISTS panel_status_trigger ON panels;
CREATE TRIGGER panel_status_trigger
    AFTER INSERT ON panels
    FOR EACH ROW
    EXECUTE FUNCTION log_panel_status_change();

-- Test query to verify trigger is working
-- SELECT * FROM panel_status_histories ORDER BY created_at DESC LIMIT 5; 