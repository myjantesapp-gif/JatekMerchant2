--
-- PostgreSQL database dump
--

\restrict BD2Hj5Z77kdSjQviAP3vDOFYihOxRdAFm6QMDO6TjaZsZaNSrAf8hYgvbeqgW6n

-- Dumped from database version 16.15 (b357239)
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: _system; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA _system;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: replit_database_migrations_v1; Type: TABLE; Schema: _system; Owner: -
--

CREATE TABLE _system.replit_database_migrations_v1 (
    id bigint NOT NULL,
    build_id text NOT NULL,
    deployment_id text NOT NULL,
    statement_count bigint NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE; Schema: _system; Owner: -
--

CREATE SEQUENCE _system.replit_database_migrations_v1_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE OWNED BY; Schema: _system; Owner: -
--

ALTER SEQUENCE _system.replit_database_migrations_v1_id_seq OWNED BY _system.replit_database_migrations_v1.id;


--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id integer NOT NULL,
    user_id integer,
    user_email text,
    user_name text,
    action text NOT NULL,
    entity text,
    entity_id integer,
    details jsonb,
    ip text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;


--
-- Name: addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.addresses (
    id integer NOT NULL,
    user_id integer NOT NULL,
    label text NOT NULL,
    full_address text NOT NULL,
    details text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: addresses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.addresses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: addresses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.addresses_id_seq OWNED BY public.addresses.id;


--
-- Name: ads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ads (
    id integer NOT NULL,
    type text DEFAULT 'vip_banner'::text NOT NULL,
    title text NOT NULL,
    subtitle text,
    badge text,
    bg_color text DEFAULT '#E91E63'::text NOT NULL,
    accent_color text,
    icon text DEFAULT 'star'::text NOT NULL,
    image_url text,
    link_url text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: ads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ads_id_seq OWNED BY public.ads.id;


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cart_items (
    id integer NOT NULL,
    cart_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    selected_size_id integer,
    selected_extra_ids integer[],
    unit_price real DEFAULT 0 NOT NULL,
    subtotal real DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cart_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cart_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cart_items_id_seq OWNED BY public.cart_items.id;


--
-- Name: carts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carts (
    id integer NOT NULL,
    user_id integer NOT NULL,
    restaurant_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: carts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.carts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: carts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.carts_id_seq OWNED BY public.carts.id;


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id integer NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text DEFAULT 'storefront'::text NOT NULL,
    accent_color text DEFAULT '#E91E63'::text NOT NULL,
    parent_id integer,
    business_type text DEFAULT 'restaurant'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    type text DEFAULT 'category'::text NOT NULL,
    banner_image_url text
);


--
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id integer NOT NULL,
    order_id integer NOT NULL,
    sender_id integer NOT NULL,
    sender_role text NOT NULL,
    sender_name text NOT NULL,
    message text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.chat_messages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: chat_messages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.chat_messages_id_seq OWNED BY public.chat_messages.id;


--
-- Name: dashboard_todos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dashboard_todos (
    id integer NOT NULL,
    user_id integer NOT NULL,
    text text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dashboard_todos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dashboard_todos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboard_todos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dashboard_todos_id_seq OWNED BY public.dashboard_todos.id;


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.drivers (
    id integer NOT NULL,
    user_id integer NOT NULL,
    name text NOT NULL,
    phone text,
    vehicle_type text,
    vehicle_plate text,
    national_id text,
    license_number text,
    photo_url text,
    profile_completed_at timestamp with time zone,
    is_available boolean DEFAULT true NOT NULL,
    total_deliveries integer DEFAULT 0 NOT NULL,
    rating real,
    latitude real DEFAULT 34.6814 NOT NULL,
    longitude real DEFAULT '-1.9078'::numeric NOT NULL,
    location_updated_at timestamp with time zone,
    push_token text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_verified boolean DEFAULT false NOT NULL
);


--
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    id integer NOT NULL,
    user_id integer NOT NULL,
    restaurant_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: favorites_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.favorites_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: favorites_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.favorites_id_seq OWNED BY public.favorites.id;


--
-- Name: menu_item_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_categories (
    id integer NOT NULL,
    restaurant_id integer,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_item_categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_item_categories_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_item_categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_item_categories_id_seq OWNED BY public.menu_item_categories.id;


--
-- Name: menu_item_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_extras (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    name text NOT NULL,
    price real DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_item_extras_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_item_extras_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_item_extras_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_item_extras_id_seq OWNED BY public.menu_item_extras.id;


--
-- Name: menu_item_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_item_sizes (
    id integer NOT NULL,
    menu_item_id integer NOT NULL,
    name text NOT NULL,
    price_adjustment real DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: menu_item_sizes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_item_sizes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_item_sizes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_item_sizes_id_seq OWNED BY public.menu_item_sizes.id;


--
-- Name: menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.menu_items (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    name text NOT NULL,
    description text,
    price real NOT NULL,
    image_url text,
    category text DEFAULT 'Main'::text NOT NULL,
    is_available boolean DEFAULT true NOT NULL,
    is_popular boolean DEFAULT false NOT NULL,
    tags text[],
    allergens text,
    prep_time_minutes integer,
    calories integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    menu_item_category_id integer,
    sort_order integer DEFAULT 0 NOT NULL,
    compare_at_price real
);


--
-- Name: menu_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.menu_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: menu_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.menu_items_id_seq OWNED BY public.menu_items.id;


--
-- Name: notification_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_prefs (
    user_id integer NOT NULL,
    push_orders boolean DEFAULT true NOT NULL,
    push_promos boolean DEFAULT true NOT NULL,
    email_receipts boolean DEFAULT true NOT NULL,
    email_newsletter boolean DEFAULT false NOT NULL,
    sms_alerts boolean DEFAULT false NOT NULL,
    language text DEFAULT 'fr'::text NOT NULL,
    push_token text,
    web_push_sub text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_items (
    id integer NOT NULL,
    order_id integer NOT NULL,
    menu_item_id integer NOT NULL,
    menu_item_name text NOT NULL,
    quantity integer NOT NULL,
    unit_price real NOT NULL,
    total_price real NOT NULL,
    selected_size text,
    selected_size_price_adjustment real,
    selected_extras text
);


--
-- Name: order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.order_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: order_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.order_items_id_seq OWNED BY public.order_items.id;


--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id integer NOT NULL,
    reference text,
    user_id integer NOT NULL,
    restaurant_id integer NOT NULL,
    driver_id integer,
    restaurant_name text NOT NULL,
    user_name text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    subtotal real NOT NULL,
    delivery_fee real DEFAULT 0 NOT NULL,
    discount_amount real DEFAULT 0 NOT NULL,
    total real NOT NULL,
    delivery_address text NOT NULL,
    notes text,
    estimated_delivery_time integer,
    kitchen_code text,
    pickup_code text,
    delivery_type text DEFAULT 'asap'::text NOT NULL,
    scheduled_for timestamp with time zone,
    is_contactless boolean DEFAULT false NOT NULL,
    proof_photo_url text,
    promo_code text,
    payment_method text DEFAULT 'cash'::text NOT NULL,
    driver_rating integer,
    driver_rating_comment text,
    customer_rating integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    currency text DEFAULT 'MAD'::text NOT NULL,
    vat_rate real DEFAULT 0 NOT NULL,
    vat_amount real DEFAULT 0 NOT NULL,
    service_fee real DEFAULT 0 NOT NULL,
    commission_rate real DEFAULT 0 NOT NULL,
    merchant_earning real DEFAULT 0 NOT NULL,
    driver_earning real DEFAULT 0 NOT NULL,
    jatek_earning real DEFAULT 0 NOT NULL,
    refunded_amount real DEFAULT 0 NOT NULL,
    refunded_jatek_earning real DEFAULT 0 NOT NULL,
    pricing_version text DEFAULT 'legacy'::text NOT NULL,
    pickup_code_expires_at timestamp with time zone,
    pickup_code_used_at timestamp with time zone
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.orders_id_seq OWNED BY public.orders.id;


--
-- Name: otp_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.otp_codes (
    id integer NOT NULL,
    phone text NOT NULL,
    code text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.otp_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: otp_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.otp_codes_id_seq OWNED BY public.otp_codes.id;


--
-- Name: payment_methods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_methods (
    id integer NOT NULL,
    user_id integer NOT NULL,
    type text NOT NULL,
    label text NOT NULL,
    last4 text,
    brand text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.payment_methods_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: payment_methods_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.payment_methods_id_seq OWNED BY public.payment_methods.id;


--
-- Name: platform_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_settings (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: platform_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_settings_id_seq OWNED BY public.platform_settings.id;


--
-- Name: promo_code_usages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_code_usages (
    id integer NOT NULL,
    promo_code_id integer NOT NULL,
    user_id integer NOT NULL,
    order_id integer NOT NULL,
    discount_amount real NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promo_code_usages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_code_usages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_code_usages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_code_usages_id_seq OWNED BY public.promo_code_usages.id;


--
-- Name: promo_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promo_codes (
    id integer NOT NULL,
    code text NOT NULL,
    description text,
    type text DEFAULT 'percentage'::text NOT NULL,
    value real DEFAULT 0 NOT NULL,
    min_order_amount real DEFAULT 0 NOT NULL,
    max_uses integer,
    used_count integer DEFAULT 0 NOT NULL,
    max_uses_per_user integer DEFAULT 1 NOT NULL,
    first_order_only boolean DEFAULT false NOT NULL,
    restaurant_id integer,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promo_codes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promo_codes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promo_codes_id_seq OWNED BY public.promo_codes.id;


--
-- Name: quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quotes (
    id integer NOT NULL,
    user_id integer NOT NULL,
    restaurant_id integer NOT NULL,
    restaurant_name text NOT NULL,
    user_name text NOT NULL,
    user_phone text,
    subject text NOT NULL,
    description text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    quoted_amount real,
    merchant_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quotes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.quotes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: quotes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.quotes_id_seq OWNED BY public.quotes.id;


--
-- Name: referrals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.referrals (
    id integer NOT NULL,
    referrer_id integer NOT NULL,
    referred_id integer,
    code text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    credit_amount real DEFAULT 20 NOT NULL,
    referred_credit_amount real DEFAULT 10 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone
);


--
-- Name: referrals_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.referrals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: referrals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.referrals_id_seq OWNED BY public.referrals.id;


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id integer NOT NULL,
    order_id integer NOT NULL,
    user_id integer NOT NULL,
    amount real NOT NULL,
    reason text NOT NULL,
    type text DEFAULT 'wallet_credit'::text NOT NULL,
    admin_id integer NOT NULL,
    admin_name text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: refunds_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refunds_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refunds_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refunds_id_seq OWNED BY public.refunds.id;


--
-- Name: restaurant_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurant_hours (
    id integer NOT NULL,
    restaurant_id integer NOT NULL,
    day_of_week integer NOT NULL,
    open_time text DEFAULT '09:00'::text NOT NULL,
    close_time text DEFAULT '22:00'::text NOT NULL,
    is_closed boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: restaurant_hours_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurant_hours_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurant_hours_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurant_hours_id_seq OWNED BY public.restaurant_hours.id;


--
-- Name: restaurants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.restaurants (
    id integer NOT NULL,
    owner_id integer NOT NULL,
    name text NOT NULL,
    description text,
    address text NOT NULL,
    phone text,
    image_url text,
    cover_image_url text,
    logo_url text,
    category text DEFAULT 'Other'::text NOT NULL,
    business_type text DEFAULT 'restaurant'::text NOT NULL,
    is_local boolean DEFAULT false NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    delivery_time integer,
    delivery_fee real,
    minimum_order real,
    rating real,
    review_count integer DEFAULT 0 NOT NULL,
    is_verified boolean DEFAULT false NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    legal_name text,
    ice text,
    printer_email text,
    profile_completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    latitude double precision DEFAULT 34.6814 NOT NULL,
    longitude double precision DEFAULT '-1.9078'::numeric NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    subcategory_id integer,
    free_delivery_threshold real DEFAULT 150 NOT NULL,
    commission_rate real DEFAULT 0.1 NOT NULL
);


--
-- Name: restaurants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.restaurants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: restaurants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.restaurants_id_seq OWNED BY public.restaurants.id;


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id integer NOT NULL,
    user_id integer NOT NULL,
    restaurant_id integer NOT NULL,
    order_id integer,
    user_name text NOT NULL,
    rating integer NOT NULL,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reviews_id_seq OWNED BY public.reviews.id;


--
-- Name: shorts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shorts (
    id integer NOT NULL,
    title text NOT NULL,
    image_url text,
    video_url text,
    restaurant_id integer,
    restaurant_name text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    audio_codec text,
    audio_bitrate integer,
    duration_seconds real
);


--
-- Name: shorts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.shorts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shorts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.shorts_id_seq OWNED BY public.shorts.id;


--
-- Name: support_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_tickets (
    id integer NOT NULL,
    user_id integer NOT NULL,
    category text NOT NULL,
    subject text NOT NULL,
    message text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.support_tickets_id_seq OWNED BY public.support_tickets.id;


--
-- Name: user_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_consents (
    user_id integer NOT NULL,
    cookies_essential boolean DEFAULT true NOT NULL,
    cookies_analytics boolean DEFAULT false NOT NULL,
    cookies_marketing boolean DEFAULT false NOT NULL,
    data_processing boolean DEFAULT true NOT NULL,
    data_sharing boolean DEFAULT false NOT NULL,
    personalization boolean DEFAULT false NOT NULL,
    marketing_emails boolean DEFAULT false NOT NULL,
    marketing_sms boolean DEFAULT false NOT NULL,
    marketing_push boolean DEFAULT false NOT NULL,
    terms_version text,
    terms_accepted_at timestamp with time zone,
    privacy_version text,
    privacy_accepted_at timestamp with time zone,
    cookies_version text,
    cookies_accepted_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    role text DEFAULT 'customer'::text NOT NULL,
    phone text,
    address text,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    loyalty_points integer DEFAULT 0 NOT NULL,
    wallet_balance real DEFAULT 0 NOT NULL,
    referral_code text,
    referred_by integer,
    assigned_shop_id integer,
    permissions jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: replit_database_migrations_v1 id; Type: DEFAULT; Schema: _system; Owner: -
--

ALTER TABLE ONLY _system.replit_database_migrations_v1 ALTER COLUMN id SET DEFAULT nextval('_system.replit_database_migrations_v1_id_seq'::regclass);


--
-- Name: activity_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);


--
-- Name: addresses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses ALTER COLUMN id SET DEFAULT nextval('public.addresses_id_seq'::regclass);


--
-- Name: ads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads ALTER COLUMN id SET DEFAULT nextval('public.ads_id_seq'::regclass);


--
-- Name: cart_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items ALTER COLUMN id SET DEFAULT nextval('public.cart_items_id_seq'::regclass);


--
-- Name: carts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts ALTER COLUMN id SET DEFAULT nextval('public.carts_id_seq'::regclass);


--
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- Name: chat_messages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages ALTER COLUMN id SET DEFAULT nextval('public.chat_messages_id_seq'::regclass);


--
-- Name: dashboard_todos id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_todos ALTER COLUMN id SET DEFAULT nextval('public.dashboard_todos_id_seq'::regclass);


--
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- Name: favorites id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites ALTER COLUMN id SET DEFAULT nextval('public.favorites_id_seq'::regclass);


--
-- Name: menu_item_categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_categories ALTER COLUMN id SET DEFAULT nextval('public.menu_item_categories_id_seq'::regclass);


--
-- Name: menu_item_extras id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_extras ALTER COLUMN id SET DEFAULT nextval('public.menu_item_extras_id_seq'::regclass);


--
-- Name: menu_item_sizes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_sizes ALTER COLUMN id SET DEFAULT nextval('public.menu_item_sizes_id_seq'::regclass);


--
-- Name: menu_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items ALTER COLUMN id SET DEFAULT nextval('public.menu_items_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: order_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items ALTER COLUMN id SET DEFAULT nextval('public.order_items_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);


--
-- Name: otp_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes ALTER COLUMN id SET DEFAULT nextval('public.otp_codes_id_seq'::regclass);


--
-- Name: payment_methods id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods ALTER COLUMN id SET DEFAULT nextval('public.payment_methods_id_seq'::regclass);


--
-- Name: platform_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings ALTER COLUMN id SET DEFAULT nextval('public.platform_settings_id_seq'::regclass);


--
-- Name: promo_code_usages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usages ALTER COLUMN id SET DEFAULT nextval('public.promo_code_usages_id_seq'::regclass);


--
-- Name: promo_codes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes ALTER COLUMN id SET DEFAULT nextval('public.promo_codes_id_seq'::regclass);


--
-- Name: quotes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes ALTER COLUMN id SET DEFAULT nextval('public.quotes_id_seq'::regclass);


--
-- Name: referrals id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals ALTER COLUMN id SET DEFAULT nextval('public.referrals_id_seq'::regclass);


--
-- Name: refunds id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds ALTER COLUMN id SET DEFAULT nextval('public.refunds_id_seq'::regclass);


--
-- Name: restaurant_hours id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_hours ALTER COLUMN id SET DEFAULT nextval('public.restaurant_hours_id_seq'::regclass);


--
-- Name: restaurants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants ALTER COLUMN id SET DEFAULT nextval('public.restaurants_id_seq'::regclass);


--
-- Name: reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews ALTER COLUMN id SET DEFAULT nextval('public.reviews_id_seq'::regclass);


--
-- Name: shorts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shorts ALTER COLUMN id SET DEFAULT nextval('public.shorts_id_seq'::regclass);


--
-- Name: support_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets ALTER COLUMN id SET DEFAULT nextval('public.support_tickets_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: replit_database_migrations_v1; Type: TABLE DATA; Schema: _system; Owner: -
--

COPY _system.replit_database_migrations_v1 (id, build_id, deployment_id, statement_count, applied_at) FROM stdin;
1	c6710a1c-674d-4f52-a2fc-07637bfbe47d	31321997-3d18-4d11-b2ac-5be1c4d19131	2	2026-09-04 15:53:01.072713+00
2	4c6db9df-12f6-4bad-b1b2-152b67b2ac33	31321997-3d18-4d11-b2ac-5be1c4d19131	1	2026-09-08 14:30:04.54027+00
3	b87ecf52-9bd0-4782-b40e-7f024eb4164f	31321997-3d18-4d11-b2ac-5be1c4d19131	1	2026-09-12 23:39:15.72854+00
\.


--
-- Data for Name: activity_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity_logs (id, user_id, user_email, user_name, action, entity, entity_id, details, ip, created_at) FROM stdin;
1	1	admin@jatek.ma	Admin Jatek	create	ad	1	\N	127.0.0.1	2026-07-19 16:02:03.271686+00
2	1	admin@jatek.ma	Admin Jatek	reset_password	user	9	\N	34.62.82.117	2026-09-02 08:35:42.666458+00
3	1	admin@jatek.ma	Admin Jatek	reset_password	user	9	\N	35.195.98.85	2026-09-02 08:43:56.57896+00
4	11	rbelmahi90@gmail.com	Belmahi Rachid Super	reset_password	user	844	\N	35.233.5.122	2026-09-03 19:58:02.715286+00
5	11	rbelmahi90@gmail.com	Belmahi Rachid Super	cancel	order	10	{"total": 102, "reason": "Jjk", "refundToWallet": true}	35.195.96.169	2026-09-04 15:58:49.60599+00
6	11	rbelmahi90@gmail.com	Belmahi Rachid Super	cancel	order	4	{"total": 48.1, "reason": "Hnk", "refundToWallet": false}	34.53.239.116	2026-09-04 15:59:04.835408+00
7	11	rbelmahi90@gmail.com	Belmahi Rachid Super	cancel	order	5	{"total": 151.5, "reason": "Hjk", "refundToWallet": true}	35.195.96.169	2026-09-04 15:59:16.90247+00
8	11	rbelmahi90@gmail.com	Belmahi Rachid Super	cancel	order	9	{"total": 63.5, "reason": "B’", "refundToWallet": true}	34.53.239.116	2026-09-04 15:59:34.592094+00
9	11	rbelmahi90@gmail.com	Belmahi Rachid Super	cancel	order	6	{"total": 32.7, "reason": "H", "refundToWallet": true}	35.195.96.169	2026-09-04 15:59:50.481263+00
10	11	rbelmahi90@gmail.com	Belmahi Rachid Super	cancel	order	12	{"total": 157, "reason": "H’́", "refundToWallet": true}	34.53.239.116	2026-09-04 16:00:17.413385+00
11	1	admin@jatek.ma	Admin Jatek	reset_password	user	905	\N	34.140.2.76	2026-09-04 17:10:27.104699+00
12	1	admin@jatek.ma	Admin Jatek	cancel	order	13	{"total": 74.5, "reason": "ferme", "refundToWallet": true}	34.53.239.116	2026-09-04 17:13:45.225063+00
13	1	admin@jatek.ma	Admin Jatek	cancel	order	14	{"total": 63.5, "reason": "ferme", "refundToWallet": true}	35.195.96.169	2026-09-04 17:14:01.844689+00
14	1	admin@jatek.ma	Admin Jatek	cancel	order	15	{"total": 192.5, "reason": "ferme", "refundToWallet": true}	35.195.96.169	2026-09-04 17:14:22.04149+00
15	1	admin@jatek.ma	Admin Jatek	cancel	order	16	{"total": 91, "reason": "ferme", "refundToWallet": true}	35.195.96.169	2026-09-04 17:17:20.539967+00
16	11	rbelmahi90@gmail.com	Belmahi Rachid Super	reset_password	user	651	\N	35.195.98.85	2026-09-07 15:51:10.211768+00
17	1	admin@jatek.ma	Admin Jatek	reset_password	user	1341	\N	34.77.210.122	2026-09-11 17:25:36.570961+00
18	11	rbelmahi90@gmail.com	Belmahi Rachid Super	update	ad	17	\N	34.22.171.14	2026-09-13 15:06:55.6834+00
19	11	rbelmahi90@gmail.com	Belmahi Rachid Super	update	ad	16	\N	34.76.81.66	2026-09-13 15:07:10.731753+00
20	11	rbelmahi90@gmail.com	Belmahi Rachid Super	update	ad	15	\N	34.22.171.14	2026-09-13 15:08:37.974655+00
21	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	14	\N	34.140.63.140	2026-09-13 22:34:49.756825+00
22	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	13	\N	34.156.205.137	2026-09-13 22:34:51.489753+00
23	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	17	\N	207.175.171.79	2026-09-13 22:34:53.191521+00
24	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	16	\N	207.175.171.79	2026-09-13 22:34:55.437867+00
25	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	15	\N	34.140.63.140	2026-09-13 22:34:57.36018+00
26	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	18	\N	34.140.63.140	2026-09-13 22:34:58.936562+00
27	11	rbelmahi90@gmail.com	Belmahi Rachid Super	delete	ad	12	\N	34.156.205.137	2026-09-13 22:35:01.05727+00
28	11	rbelmahi90@gmail.com	Belmahi Rachid Super	update	ad	11	\N	35.205.112.89	2026-09-13 22:36:15.518191+00
29	11	rbelmahi90@gmail.com	Belmahi Rachid Super	update	ad	19	\N	34.76.51.129	2026-09-13 22:36:29.866239+00
30	11	rbelmahi90@gmail.com	Belmahi Rachid Super	update	ad	11	\N	35.205.112.89	2026-09-13 22:36:51.410076+00
31	11	rbelmahi90@gmail.com	Belmahi Rachid Super	reset_password	user	1065	\N	34.156.129.20	2026-09-14 01:01:50.118618+00
32	11	rbelmahi90@gmail.com	Belmahi Rachid Super	db_backup	system	\N	\N	34.156.129.20	2026-09-14 01:04:01.797191+00
\.


--
-- Data for Name: addresses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.addresses (id, user_id, label, full_address, details, is_default, created_at) FROM stdin;
1	794	Gh	Boulevard Annakhil, Hay Debbane, Oujda	\N	t	2026-09-02 02:42:52.657387+00
2	1320	Hh	Boulevard Fès, Hay Rabat, Oujda	\N	t	2026-09-10 21:36:37.98899+00
\.


--
-- Data for Name: ads; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ads (id, type, title, subtitle, badge, bg_color, accent_color, icon, image_url, link_url, is_active, sort_order, created_at, updated_at) FROM stdin;
19	promo_banner	Livraison à 5 MAD	Ce week-end uniquement, commandez plus!	WEEKEND	#2E7D32	#FF80AB	bicycle	/api/storage/objects/images/89724a08-67f8-4f34-b212-40af28d4c8c2		t	1	2026-07-22 05:09:35.478958+00	2026-09-13 22:36:29.813+00
11	vip_banner	Livraisons illimitée ssans frais	Abonnez-vous et économisez chaque jour	JATEK PRO	#E91E63	#FF80AB	rocket	/api/storage/objects/images/12887832-0ac1-40e0-8d15-168ceecf2042		t	0	2026-07-22 05:09:35.478958+00	2026-09-13 22:36:51.329+00
\.


--
-- Data for Name: app_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_config (key, value, updated_at) FROM stdin;
defaultLanguage	"fr"	2026-09-14 00:59:55.734+00
maintenanceMode	false	2026-09-14 00:59:55.774+00
featuredCount	6	2026-09-14 00:59:55.81+00
homeOrder	["categories", "shorts", "popular", "banners", "new_products", "all"]	2026-09-14 00:59:55.847+00
welcomeMessage	"Bienvenue sur Jatek !"	2026-09-14 00:59:55.883+00
homeSections	{"shops": {"limit": 6, "title": "Boutiques", "source": "shops", "visible": true}, "popular": {"limit": 6, "title": "Produits populaires", "source": "popular", "visible": true}, "new_products": {"limit": 6, "title": "Promos", "source": "promos", "visible": true}, "new_restaurants": {"limit": 6, "title": "Restauration", "source": "new_restaurants", "visible": true}}	2026-09-14 00:59:55.918+00
\.


--
-- Data for Name: cart_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cart_items (id, cart_id, menu_item_id, quantity, selected_size_id, selected_extra_ids, unit_price, subtotal, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: carts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.carts (id, user_id, restaurant_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.categories (id, name, slug, icon, accent_color, parent_id, business_type, is_active, sort_order, created_at, updated_at, type, banner_image_url) FROM stdin;
57	Restauration	restauration	restaurant	#B85C00	\N	restaurant	t	0	2026-07-22 05:09:35.462433+00	2026-07-22 05:09:35.462433+00	category	\N
58	Épicerie	epicerie	basket	#2E7D32	\N	grocery	t	1	2026-07-22 05:09:35.462433+00	2026-07-22 05:09:35.462433+00	category	\N
59	Santé	sante	medkit	#C62828	\N	pharmacy	t	2	2026-07-22 05:09:35.462433+00	2026-07-22 05:09:35.462433+00	category	\N
60	Supermarché	supermarche	cart	#E65100	\N	supermarket	t	3	2026-07-22 05:09:35.462433+00	2026-07-22 05:09:35.462433+00	category	\N
61	Boutiques	boutiques	storefront	#880E4F	\N	shop	t	4	2026-07-22 05:09:35.462433+00	2026-07-22 05:09:35.462433+00	category	\N
62	Coursier	coursier	bicycle	#1A237E	\N	services	t	5	2026-07-22 05:09:35.462433+00	2026-07-22 05:09:35.462433+00	category	\N
63	Burgers	burgers	fast-food	#F57C00	57	restaurant	t	0	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
64	Pizza	pizza	pizza	#D32F2F	57	restaurant	t	1	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
65	Sushi	sushi	fish	#0288D1	57	restaurant	t	2	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
66	Tacos	tacos	restaurant	#F9A825	57	restaurant	t	3	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
67	Poulet	poulet	restaurant	#F57C00	57	restaurant	t	4	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
68	Sandwichs	sandwichs	restaurant	#6D4C41	57	restaurant	t	5	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
69	Salades	salades	leaf	#388E3C	57	restaurant	t	6	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
70	Desserts	desserts	cafe	#7B1FA2	57	restaurant	t	7	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
71	Fruits & Légumes	fruits-legumes	nutrition	#388E3C	58	grocery	t	0	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
72	Boissons	boissons	water	#0277BD	58	grocery	t	1	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
73	Snacks	snacks	fast-food	#EF6C00	58	grocery	t	2	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
74	Mode	mode	shirt	#AD1457	61	shop	t	0	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
75	Électronique	electronique	phone-portrait	#1565C0	61	shop	t	1	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
76	Beauté	beaute	sparkles	#6A1B9A	61	shop	t	2	2026-07-22 05:09:35.471616+00	2026-07-22 05:09:35.471616+00	category	\N
78	Boulangerie	boulangerie	storefront	#E91E63	60	supermarket	t	0	2026-09-07 18:59:55.097546+00	2026-09-07 18:59:55.097546+00	subcategory	\N
77	Supermarche	supermarche-2	storefront	#E91E63	60	supermarket	t	2	2026-09-07 18:59:36.162834+00	2026-09-07 19:00:06.151+00	subcategory	\N
\.


--
-- Data for Name: chat_messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.chat_messages (id, order_id, sender_id, sender_role, sender_name, message, read_at, created_at) FROM stdin;
\.


--
-- Data for Name: dashboard_todos; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dashboard_todos (id, user_id, text, done, created_at) FROM stdin;
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drivers (id, user_id, name, phone, vehicle_type, vehicle_plate, national_id, license_number, photo_url, profile_completed_at, is_available, total_deliveries, rating, latitude, longitude, location_updated_at, push_token, created_at, updated_at, is_verified) FROM stdin;
1	9	Livreur Test 1	+212600000001	Moto	12345-A-1	K123456	P-2024-001	\N	2026-08-09 19:22:04.85+00	t	2	\N	34.6814	-1.9086	2026-08-09 19:27:15.264+00	\N	2026-07-19 16:01:21.091162+00	2026-09-02 08:43:35.513+00	t
8	905	Fahrer	+212666711202	Moto	3838h	\N	\N	\N	2026-09-04 14:01:15.287+00	t	0	\N	50.080845	8.232222	2026-09-04 14:53:29.89+00	\N	2026-09-04 14:01:15.224767+00	2026-09-04 17:11:25.963+00	t
9	1065	Driv3@straight-path.fr	+33780726010	Moto	Jjxjx	Jdkdid	Jdidid	\N	2026-09-07 15:51:38.819+00	t	0	\N	35.617764	-5.2722917	2026-09-07 15:56:55.161+00	\N	2026-09-07 15:51:38.741664+00	2026-09-07 15:56:55.161+00	t
7	876	Driv10@straight-path.fr	+33780726013	moto	Hejdj	Yejzj	Jekzkz	\N	2026-09-03 23:38:13.867+00	t	0	\N	35.61773	-5.272322	2026-09-03 23:47:30.091+00	\N	2026-09-03 23:38:13.834738+00	2026-09-03 23:47:30.091+00	t
2	651	Driv6	+33780726015	Moto	Tfjhh	Uthkhh	Hguhb	\N	2026-08-22 01:37:35.928+00	t	0	\N	35.61139	-5.270302	2026-09-08 16:12:53.641+00	\N	2026-08-22 01:37:35.92151+00	2026-09-08 16:12:58.492+00	t
5	844	Driv9@straight-path.fr	+33780726017	moto	Hsjqi1j	Ksiao	Udidid	\N	2026-09-03 12:50:21.964+00	t	0	\N	35.61775	-5.2723036	2026-09-03 23:53:02.593+00	\N	2026-09-03 12:50:21.929196+00	2026-09-03 23:53:02.593+00	t
\.


--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.favorites (id, user_id, restaurant_id, created_at) FROM stdin;
1	1066	10	2026-09-07 15:54:02.440455+00
\.


--
-- Data for Name: menu_item_categories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_item_categories (id, restaurant_id, name, sort_order, is_active, created_at, updated_at) FROM stdin;
28	10	Smashburger	1	t	2026-09-01 07:17:51.982548+00	2026-09-01 07:17:51.982548+00
31	\N	Boissons	4	t	2026-09-04 02:19:20.613968+00	2026-09-04 02:19:20.613968+00
29	10	Poulet	1	t	2026-09-01 22:37:55.55571+00	2026-09-04 02:19:32.062+00
30	\N	Tacos	0	t	2026-09-04 02:19:09.276028+00	2026-09-04 02:19:39.201+00
32	\N	Desserts	0	t	2026-09-04 02:19:46.761707+00	2026-09-04 02:19:46.761707+00
33	\N	Kids	4	t	2026-09-04 02:22:23.181311+00	2026-09-04 02:22:23.181311+00
34	\N	Salade	2	t	2026-09-04 02:23:11.2805+00	2026-09-04 02:23:11.2805+00
35	\N	Fruits & Légumes	1	t	2026-09-07 19:10:41.260674+00	2026-09-07 19:10:41.260674+00
36	\N	Viande & Poisson	2	t	2026-09-07 19:10:58.708535+00	2026-09-07 19:10:58.708535+00
37	\N	Pain & Boulangerie	3	t	2026-09-07 19:11:17.400012+00	2026-09-07 19:11:17.400012+00
38	\N	Épices & Sauces	4	t	2026-09-07 19:11:35.032176+00	2026-09-07 19:11:35.032176+00
\.


--
-- Data for Name: menu_item_extras; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_item_extras (id, menu_item_id, name, price, sort_order, is_available, created_at, updated_at) FROM stdin;
6	42	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
7	42	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
8	42	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
9	43	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
10	43	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
11	43	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
12	44	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
13	44	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
14	44	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
15	45	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
16	45	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
17	45	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
18	46	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
19	46	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
20	46	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
21	47	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
22	47	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
23	47	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
27	49	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
28	49	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
29	49	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
30	50	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
31	50	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
32	50	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
33	51	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
34	51	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
35	51	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
36	52	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
37	52	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
38	52	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
39	53	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
40	53	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
41	53	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
42	54	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
43	54	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
44	54	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
45	55	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
46	55	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
47	55	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
48	56	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
49	56	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
50	56	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
51	57	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
52	57	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
53	57	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
54	58	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
55	58	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
56	58	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
57	59	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
58	59	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
59	59	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
60	60	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
61	60	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
62	60	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
63	61	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
64	61	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
65	61	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
66	62	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
67	62	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
68	62	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
69	63	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
70	63	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
71	63	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
72	64	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
73	64	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
74	64	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
75	65	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
76	65	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
77	65	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
78	66	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
79	66	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
80	66	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
81	67	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
82	67	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
83	67	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
84	68	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
85	68	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
86	68	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
87	69	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
88	69	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
89	69	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
90	70	sans tomate	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
91	70	ajouter sauce	0	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
92	70	autre	0	2	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
93	41	sans tomate	0	0	t	2026-08-22 01:41:14.887687+00	2026-08-22 01:41:14.887687+00
94	41	ajouter sauce	0	1	t	2026-08-22 01:41:14.887687+00	2026-08-22 01:41:14.887687+00
95	41	autre	0	2	t	2026-08-22 01:41:14.887687+00	2026-08-22 01:41:14.887687+00
96	83	sans tomate	0	0	t	2026-08-22 01:43:15.239799+00	2026-08-22 01:43:15.239799+00
97	83	ajouter sauce	0	1	t	2026-08-22 01:43:15.239799+00	2026-08-22 01:43:15.239799+00
98	83	autre	0	2	t	2026-08-22 01:43:15.239799+00	2026-08-22 01:43:15.239799+00
\.


--
-- Data for Name: menu_item_sizes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_item_sizes (id, menu_item_id, name, price_adjustment, sort_order, is_available, created_at, updated_at) FROM stdin;
6	42	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
7	42	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
8	43	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
9	43	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
10	44	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
11	44	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
12	45	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
13	45	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
14	46	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
15	46	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
16	47	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
17	47	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
20	49	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
21	49	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
22	50	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
23	50	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
24	51	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
25	51	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
26	52	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
27	52	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
28	63	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
29	63	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
30	64	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
31	64	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
32	65	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
33	65	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
34	66	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
35	66	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
36	67	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
37	67	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
38	68	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
39	68	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
40	69	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
41	69	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
42	70	Solo	0	0	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
43	70	Menu	15	1	t	2026-08-22 00:35:39.126607+00	2026-08-22 00:35:39.126607+00
44	41	Solo	0	0	t	2026-08-22 01:41:14.887687+00	2026-08-22 01:41:14.887687+00
45	41	Menu	15	1	t	2026-08-22 01:41:14.887687+00	2026-08-22 01:41:14.887687+00
46	81	S	20	0	t	2026-08-22 01:42:24.114725+00	2026-08-22 01:42:24.114725+00
47	81	M	25	2	t	2026-08-22 01:42:36.669814+00	2026-08-22 01:42:36.669814+00
48	81	L	35	3	t	2026-08-22 01:42:48.151644+00	2026-08-22 01:42:48.151644+00
49	83	Solo	0	0	t	2026-08-22 01:43:15.239799+00	2026-08-22 01:43:15.239799+00
50	83	Menu	15	1	t	2026-08-22 01:43:15.239799+00	2026-08-22 01:43:15.239799+00
\.


--
-- Data for Name: menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.menu_items (id, restaurant_id, name, description, price, image_url, category, is_available, is_popular, tags, allergens, prep_time_minutes, calories, created_at, updated_at, menu_item_category_id, sort_order, compare_at_price) FROM stdin;
77	10	Lotus	\N	25	/api/storage/objects/medias/3d362a68-5120-40cb-b7fd-93f6ba1a230a	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:38.575+00	\N	0	\N
78	10	Oreo	\N	25	/api/storage/objects/medias/317f7fa9-8c20-4f85-9a98-2fb1f2750ccc	Desserts	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:24:21.204+00	32	0	\N
42	10	Smash’s Classic	Viande hachee fraiche, Salade, Tomate, Cheddar, Sauce Smash’s, Potato Bun.	50	/api/storage/objects/medias/7a8c2582-cbe7-40a2-8373-ea46d1048b69	Smashburger	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:19:55.419+00	28	0	\N
49	10	Double Smash’s Simple	Viande hachee fraiche, Cornichons, Ketchup, Moutarde, Cheddar, Potato Bun.	55	/api/storage/objects/medias/71f26fc3-8424-49ce-96b1-68c48d45d531	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:02.356+00	28	0	\N
50	10	Double Smash’s Classic	Viande hachee fraiche, Salade, Tomate, Cheddar, Sauce Smash’s, Potato Bun.	65	/api/storage/objects/medias/7a8c2582-cbe7-40a2-8373-ea46d1048b69	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:08.115+00	28	0	\N
51	10	Double Smash’s Oignon	Viande hachee fraiche, Oignon, Cornichons, Ketchup, Moutarde, Cheddar, Potato Bun.	60	/api/storage/objects/medias/44d1bab3-d58c-4a73-bb3e-35870fd232a5	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:14.668+00	28	0	\N
53	10	DEAL DU MARDI	\N	20	/api/storage/objects/medias/43ca31c1-4d6e-4689-acf2-6aab0d802c86	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:25.905+00	28	0	\N
54	10	Box Mixte	\N	40	/api/storage/objects/medias/5040d452-ceea-46fb-85ff-c460b5994faa	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:34.338+00	29	0	\N
55	10	Box Tenders	\N	30	/api/storage/objects/medias/e6eaaed4-9d0f-46bd-8a59-0390ef608d2b	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:40.405+00	29	0	\N
56	10	Box Pilons	\N	35	/api/storage/objects/medias/dc9a01d8-0253-451a-ad41-bd563de855cb	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:46.579+00	29	0	\N
58	10	Nashvilles Tenders	\N	30	/api/storage/objects/medias/691c1bb6-107f-45ed-b17e-94eaac5e61e5	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:20:58.069+00	29	0	\N
59	10	Nashvilles Wings	\N	35	/api/storage/objects/medias/23d4a1e6-c347-4082-a7e7-590bef208d8d	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:03.474+00	29	0	\N
60	10	Family Hot Wings	(25 Wings)	160	/api/storage/objects/medias/7d25ceb9-d6cb-4ee1-aeb4-e13d79e19a18	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:10.102+00	29	0	\N
61	10	Family Wings & Pilons	(15 Wings, 9 Pilons)	170	/api/storage/objects/medias/e6a8bf47-0ec3-424e-b9f1-46c2e063bedd	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:16.413+00	29	0	\N
62	10	Family Mixte	(16 Wings, 6 Pilons, 6 Tenders)	210	/api/storage/objects/medias/1e872453-8f42-4a77-b187-c0b82cb9a47b	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:21.919+00	29	0	\N
63	10	Tacos Poulet	\N	35	/api/storage/objects/medias/087c0738-c934-4bda-b6eb-bf5056c128c4	Tacos	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:26.565+00	30	0	\N
64	10	Tacos Nuggets	\N	40	/api/storage/objects/medias/087c0738-c934-4bda-b6eb-bf5056c128c4	Tacos	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:30.615+00	30	0	\N
65	10	Tacos Kefta	\N	40	/api/storage/objects/medias/087c0738-c934-4bda-b6eb-bf5056c128c4	Tacos	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:34.169+00	30	0	\N
66	10	Tacos Tenders	\N	45	/api/storage/objects/medias/087c0738-c934-4bda-b6eb-bf5056c128c4	Tacos	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:37.681+00	30	0	\N
67	10	Tacos Mixte	\N	45	/api/storage/objects/medias/087c0738-c934-4bda-b6eb-bf5056c128c4	Tacos	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:41.532+00	30	0	\N
68	10	Wrapstar Dynamite	\N	40	/api/storage/objects/medias/6dfc66cf-0935-4ac4-9df9-38f21495773d	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:51.773+00	28	0	\N
69	10	Wrapstar chick'n roll	\N	40	/api/storage/objects/medias/a1d4a40f-c922-4658-9b56-5fb81270178a	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:21:57.162+00	28	0	\N
70	10	Wrapstar Monster	\N	60	/api/storage/objects/medias/3c8f9913-b057-49c7-bb4e-6c4abce28825	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:22:02.746+00	28	0	\N
71	10	Menu kids Nuggets	Nuggets	35	/api/storage/objects/medias/6dc0ca99-6d42-4dc1-9236-5e02186688df	Kids	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:22:46.612+00	33	0	\N
72	10	Menu kids Mini Tacos	Mini Tacos	35	/api/storage/objects/medias/38ca21ad-7eac-4241-886a-353db23ccc09	Kids	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:22:51.982+00	33	0	\N
73	10	Menu kids Cheeseburger	Cheeseburger	35	/api/storage/objects/medias/1c900f0b-c7ca-45a5-9a62-0effaad52091	Kids	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:22:57.659+00	33	0	\N
74	10	Salade Veggie	\N	30	/api/storage/objects/medias/56e3edbc-112b-44f6-b347-960ebe26b7e7	Salade	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:23:27.131+00	34	0	\N
75	10	Salade Crispy Chicken	\N	35	/api/storage/objects/medias/e61a2cc8-09f2-410f-8b35-a0a37c3f7b82	Salade	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:23:35.389+00	34	0	\N
76	10	Tiramisu	\N	25	/api/storage/objects/medias/0da94943-9103-4de3-afd9-4942a4e2e17a	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:23:39.945+00	32	0	\N
80	10	Shakes Fraise	\N	25	/api/storage/objects/medias/4210c4e1-1aa5-429a-8268-974e95715131	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:23:49.034+00	32	0	\N
79	10	Pistache	\N	30	/api/storage/objects/medias/4625909d-17b2-4c7e-9e91-df42ae07823a	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:23:53.651+00	32	0	\N
81	10	Shakes Oreo	\N	25	/api/storage/objects/medias/7546d0fe-d168-4448-8d24-c338fb105c26	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:23:59.459+00	32	0	\N
82	10	Shakes Lotus	\N	25	/api/storage/objects/medias/938c8ed8-9403-41f2-8b70-caccd25a8a48	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:24:05.405+00	32	0	\N
83	10	Shakes Nutella	\N	30	/api/storage/objects/medias/836fbc80-0c7d-4a0a-a7ee-95248062935f	Desserts	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:24:10.941+00	32	0	\N
52	10	Double Smoky Smash’s	Viande hachee fraiche, Cheddar, Dinde fumee, Sauce smoky, Salade, Tomate, Oignon, Potato Bun.	80	/api/storage/objects/medias/7d5a42fa-86b5-42cf-ad06-798ab3f4b034	Smashburger	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:24:15.808+00	28	0	\N
57	10	Box Hot Wings	\N	35	/api/storage/objects/medias/fbd99e9e-aa2d-43f7-8bc6-71751c9e04da	Poulet	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-11 12:40:45.856+00	29	1	\N
84	10	Shakes Frappuccino	\N	25	/api/storage/objects/medias/c6a79d56-a96e-4809-99d0-a7fa9894802d	Shakes	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:39.507+00	\N	0	\N
85	10	Sundae Nature	\N	15	/api/storage/objects/medias/b314fece-a9d8-4ae2-9ad2-534cbfc28bf2	Sundae	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:39.652+00	\N	0	\N
86	10	Sundae Fraise	\N	18	/api/storage/objects/medias/960da55e-5e4b-4edf-a4c8-735ca17f44e0	Sundae	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:39.844+00	\N	0	\N
87	10	Sundae Choco	\N	18	/api/storage/objects/medias/07e06b3b-be48-451c-8e09-d763880f4fbe	Sundae	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:39.979+00	\N	0	\N
88	10	Sundae Caramel	\N	18	/api/storage/objects/medias/3313d6fd-921d-456e-a0c5-6c37c56e528d	Sundae	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:40.346+00	\N	0	\N
89	10	Sundae Oreo	\N	25	/api/storage/objects/medias/e1b92951-a8fd-45b2-97ad-133a4b592d7d	Sundae	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:40.514+00	\N	0	\N
90	10	Sundae Lotus	\N	25	/api/storage/objects/medias/56229963-2b75-4127-b66a-60cd3961294b	Sundae	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:40.661+00	\N	0	\N
91	10	Coca Cola	25cl	10	/api/storage/objects/medias/a2a102da-9c6b-432d-8db8-d3a1dd526998	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:40.8+00	\N	0	\N
92	10	Coca ZERO	25cl	10	/api/storage/objects/medias/053d7619-d132-42cb-a01d-9c13e0307183	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:40.94+00	\N	0	\N
93	10	Sprite	25cl	10	/api/storage/objects/medias/3a41160e-d85e-4e65-a611-02918100c33b	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.068+00	\N	0	\N
94	10	Fanta Lemon	25cl	10	/api/storage/objects/medias/4485cc9c-01fe-4db6-8ed6-a18a0d87ec30	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.217+00	\N	0	\N
95	10	Fanta Orange	25cl	10	/api/storage/objects/medias/3d73ec11-5c75-4f3a-8c23-1f22fdc76bb5	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.349+00	\N	0	\N
96	10	Glass Tropical	25cl	10	/api/storage/objects/medias/9b71692f-ea39-4ff6-8015-08be209ec9a0	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.477+00	\N	0	\N
97	10	Glass Pomme	25cl	10	/api/storage/objects/medias/6e9dc952-db81-413a-8cc5-9375c8f62672	Boissons	f	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.618+00	\N	0	\N
98	10	Hawaï Ananas	25cl	10	/api/storage/objects/medias/fe4599ba-12b4-41da-90a2-577a2d9c5bf2	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.75+00	\N	0	\N
99	10	Hawaï Tropical	25cl	10	/api/storage/objects/medias/3f17d3c5-5a31-4c1a-afb3-14922445e4e4	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:41.875+00	\N	0	\N
100	10	Orangina	25cl	10	/api/storage/objects/medias/3d1fad09-209f-4672-a78f-3165ccbec2cc	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.025+00	\N	0	\N
101	10	Pom's	25cl	10	/api/storage/objects/medias/2e93abe5-4424-4f24-8016-c914d1e4a25f	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.152+00	\N	0	\N
102	10	Schweppes Ananas	25cl	10	/api/storage/objects/medias/b4a84a5a-d74d-4878-9f93-1518f49bb599	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.304+00	\N	0	\N
103	10	Schweppes Tonic	25cl	10	/api/storage/objects/medias/d047a2a8-0cc3-4066-a498-618d377f6be9	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.433+00	\N	0	\N
104	10	Schweppes Mojito	25cl	10	/api/storage/objects/medias/bf9da0b7-7ab8-4d12-960d-75c857fb64fc	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.583+00	\N	0	\N
105	10	Oasis Tropical	33cl	20	/api/storage/objects/medias/e8053455-3ae4-463a-a991-7643e7e68a57	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.715+00	\N	0	\N
106	10	Oasis cassis framboise	33cl	20	/api/storage/objects/medias/0487eabb-0b5a-4399-bd6b-2093d6def3e3	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.843+00	\N	0	\N
107	10	Oulmes	50cl	10	/api/storage/objects/medias/e4d191d1-0a99-4dc2-980c-9144701ee8f1	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:42.983+00	\N	0	\N
108	10	Eau Minerale	50cl	7	/api/storage/objects/medias/63e6fad7-ce19-4eb1-942f-660662b84ef1	Boissons	t	f	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-08-23 14:42:43.125+00	\N	0	\N
41	10	Smash’s Simple	Viande hachee fraiche, Cornichons, Ketchup, Moutarde, Cheddar, Potato Bun.	40	/api/storage/objects/medias/71f26fc3-8424-49ce-96b1-68c48d45d531	Poulet	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:19:32.094+00	29	0	\N
43	10	Smash’s Oignon	Viande hachee fraiche, Oignon, Cornichons, Ketchup, Moutarde, Cheddar, Potato Bun.	45	/api/storage/objects/medias/44d1bab3-d58c-4a73-bb3e-35870fd232a5	Tacos	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:19:39.234+00	\N	0	\N
44	10	Smoky Smash’s	Viande hachee fraiche, Cheddar, Dinde fumee, Sauce smoky, Salade, Tomate, Oignon, Potato Bun.	65	/api/storage/objects/medias/7d5a42fa-86b5-42cf-ad06-798ab3f4b034	Tacos	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:19:39.234+00	\N	0	\N
45	10	Dynamite Crunchy Chicken	Croustillantes Strips de Poulet, Salade, Tomate, Cheddar, Sauce Dynamite, Potato Bun.	50	/api/storage/objects/medias/1b6fe135-c9e9-42b0-a62b-357b9a6f042d	Tacos	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:19:39.234+00	\N	0	\N
46	10	Smash’s Crunchy Chicken	Tendres de Poulet, Salade, Dinde fumee, tomate, Oignon, Cheddar, Sauce Smash’s, Potato Bun.	60	/api/storage/objects/medias/e750adc7-8ecc-4a70-bfd5-5a08cf38b3d6	Tacos	t	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-04 02:19:39.234+00	\N	0	\N
109	11	Orange à jus 1Kg	\N	7.9	/api/storage/objects/medias/c3af83ea-c5e8-49a0-a483-7c73b5e36f34	Fruits & Légumes	t	f	\N	\N	\N	\N	2026-09-07 19:13:27.72383+00	2026-09-07 19:13:27.72383+00	35	0	\N
110	11	Banane 1Kg	\N	19.9	/api/storage/objects/medias/d3568432-1912-4212-83e6-18db29ed856e	Fruits & Légumes	t	f	\N	\N	\N	\N	2026-09-07 19:14:02.563186+00	2026-09-10 20:09:55.253+00	35	1	\N
47	10	Golden Tiger	2 Tenders, Salade, Oignons rouges, Cheddar, Sauce Tiger, Potato Bun.	65	/api/storage/objects/medias/f2fa39ab-9a4c-4355-be1d-b1e8ea59f182	Tacos	f	t	\N	\N	\N	\N	2026-08-22 00:35:39.126607+00	2026-09-11 16:41:27.409+00	\N	0	\N
\.


--
-- Data for Name: notification_prefs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_prefs (user_id, push_orders, push_promos, email_receipts, email_newsletter, sms_alerts, language, push_token, web_push_sub, updated_at) FROM stdin;
1320	t	t	t	f	f	fr	\N	\N	2026-09-10 21:33:46.610869+00
1066	t	t	t	f	f	fr	ExponentPushToken[rZ2myzPV2OVrKBevSNZWfK]	\N	2026-09-11 23:50:27.703+00
11	t	t	t	f	f	fr	\N	\N	2026-09-12 03:07:01.082783+00
1341	t	t	t	f	f	fr	ExponentPushToken[IJJ1pyNwoDoLZm8yrOpdRB]	\N	2026-09-12 11:20:42.647+00
1	t	t	t	f	f	fr	ExponentPushToken[-zpMGhJUjeCsYC8tmQQDhK]	\N	2026-09-13 12:15:26.376+00
914	t	t	t	f	f	fr	\N	\N	2026-09-04 15:55:43.358762+00
794	t	t	t	f	f	fr	ExponentPushToken[-DwGzoIQNu15rpU7dydDi1]	\N	2026-09-07 00:16:46.229+00
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, type, title, body, data, read_at, created_at) FROM stdin;
1	425	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 1}	\N	2026-08-09 19:21:30.438456+00
2	425	order_status	Commande acceptée ✅	Pizza Palace a confirmé votre commande.	{"status": "accepted", "orderId": 1}	\N	2026-08-09 19:21:30.451844+00
3	425	order_status	En préparation 🍳	Pizza Palace prépare votre commande.	{"status": "preparing", "orderId": 1}	\N	2026-08-09 19:21:30.475175+00
4	425	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 1}	\N	2026-08-09 19:21:30.485376+00
5	426	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 2}	\N	2026-08-09 19:22:04.915208+00
6	426	order_status	Commande acceptée ✅	Pizza Palace a confirmé votre commande.	{"status": "accepted", "orderId": 2}	\N	2026-08-09 19:22:04.931339+00
7	426	order_status	En préparation 🍳	Pizza Palace prépare votre commande.	{"status": "preparing", "orderId": 2}	\N	2026-08-09 19:22:04.943495+00
8	426	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 2}	\N	2026-08-09 19:22:04.954353+00
9	426	order_status	En route 🛵	Votre livreur est en chemin vers vous.	{"status": "picked_up", "orderId": 2}	\N	2026-08-09 19:22:04.971058+00
10	426	order_status	Commande livrée 🎉	Bon appétit ! Évaluez votre expérience.	{"status": "delivered", "orderId": 2}	\N	2026-08-09 19:22:05.006803+00
11	427	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 3}	\N	2026-08-09 19:27:15.190473+00
12	427	order_status	Commande acceptée ✅	Pizza Palace a confirmé votre commande.	{"status": "accepted", "orderId": 3}	\N	2026-08-09 19:27:15.208843+00
13	427	order_status	En préparation 🍳	Pizza Palace prépare votre commande.	{"status": "preparing", "orderId": 3}	\N	2026-08-09 19:27:15.223639+00
14	427	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 3}	\N	2026-08-09 19:27:15.23565+00
15	427	order_status	En route 🛵	Votre livreur est en chemin vers vous.	{"status": "picked_up", "orderId": 3}	\N	2026-08-09 19:27:15.257215+00
16	427	order_status	Commande livrée 🎉	Bon appétit ! Évaluez votre expérience.	{"status": "delivered", "orderId": 3}	\N	2026-08-09 19:27:15.293996+00
17	794	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 4}	\N	2026-09-02 02:42:11.83909+00
18	794	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 5}	\N	2026-09-02 02:42:56.515827+00
19	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 5}	\N	2026-09-02 02:45:30.109922+00
20	794	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 5}	\N	2026-09-02 02:45:32.978695+00
21	794	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 5}	\N	2026-09-02 02:45:35.387137+00
22	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 4}	\N	2026-09-02 02:45:43.601137+00
23	794	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 4}	\N	2026-09-02 02:46:13.163403+00
24	794	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 4}	\N	2026-09-02 02:46:15.850029+00
25	794	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 6}	\N	2026-09-02 02:49:07.142271+00
26	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 6}	\N	2026-09-02 02:49:28.247311+00
27	794	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 6}	\N	2026-09-02 02:49:33.165859+00
28	794	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 6}	\N	2026-09-02 02:49:35.668597+00
29	815	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 7}	\N	2026-09-02 13:36:31.139737+00
30	815	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 7}	\N	2026-09-02 13:37:19.344539+00
31	815	order_status	Commande confirmée ✅	Smash's Burger Oujda confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 7}	\N	2026-09-02 13:37:46.740374+00
32	815	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 7}	\N	2026-09-02 13:38:23.633567+00
33	815	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 7}	\N	2026-09-02 13:38:42.53059+00
34	1	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 8}	\N	2026-09-03 07:30:36.921581+00
35	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 5}	\N	2026-09-03 12:51:01.636659+00
36	815	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 9}	\N	2026-09-03 15:49:55.722482+00
37	794	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 10}	\N	2026-09-03 21:30:57.984913+00
38	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 4}	\N	2026-09-03 22:28:39.077913+00
39	815	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 9}	\N	2026-09-03 22:33:15.965916+00
40	815	order_status	Commande confirmée ✅	Smash's Burger Oujda confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 9}	\N	2026-09-03 22:33:22.820612+00
41	815	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 9}	\N	2026-09-03 22:33:27.610169+00
42	815	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 9}	\N	2026-09-03 22:33:35.78959+00
43	815	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 9}	\N	2026-09-03 23:47:16.152636+00
44	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 10}	\N	2026-09-04 02:24:32.7667+00
45	794	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 10}	\N	2026-09-04 02:24:37.309703+00
46	794	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 10}	\N	2026-09-04 02:24:39.706196+00
47	1	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 8}	\N	2026-09-04 02:24:47.305707+00
48	1	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 8}	\N	2026-09-04 02:24:49.519289+00
49	1	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 8}	\N	2026-09-04 02:24:51.735287+00
50	794	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 11}	\N	2026-09-04 02:31:41.415259+00
51	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 11}	\N	2026-09-04 14:00:17.687251+00
52	794	order_status	Commande confirmée ✅	Smash's Burger Oujda confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 11}	\N	2026-09-04 14:00:21.124487+00
53	794	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 11}	\N	2026-09-04 14:00:24.131184+00
54	794	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 11}	\N	2026-09-04 14:00:30.283752+00
55	794	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 10}	\N	2026-09-04 14:03:07.020495+00
56	815	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 12}	\N	2026-09-04 14:05:54.010496+00
57	815	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 12}	\N	2026-09-04 14:06:25.82153+00
58	815	order_status	Commande confirmée ✅	Smash's Burger Oujda confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 12}	\N	2026-09-04 14:06:41.298817+00
59	815	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 12}	\N	2026-09-04 14:06:50.096186+00
60	815	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 12}	\N	2026-09-04 14:06:54.454166+00
61	914	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 13}	\N	2026-09-04 15:55:56.329072+00
62	914	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 14}	\N	2026-09-04 15:56:14.314222+00
63	914	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 15}	\N	2026-09-04 15:56:35.234788+00
64	914	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 15}	\N	2026-09-04 15:57:54.544335+00
65	914	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 15}	\N	2026-09-04 15:57:58.039862+00
66	914	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 15}	\N	2026-09-04 15:58:01.655811+00
67	914	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 14}	\N	2026-09-04 15:58:07.329327+00
68	914	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 14}	\N	2026-09-04 15:58:10.650471+00
69	914	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 14}	\N	2026-09-04 15:58:13.110817+00
70	914	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 13}	\N	2026-09-04 15:58:19.077204+00
71	914	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 13}	\N	2026-09-04 15:58:25.622036+00
72	914	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 13}	\N	2026-09-04 15:58:31.343455+00
73	815	order_status	Commande annulée ❌	Votre commande a été annulée.	{"status": "cancelled", "orderId": 7}	\N	2026-09-04 15:59:57.320598+00
74	1	order_status	Commande annulée ❌	Votre commande a été annulée.	{"status": "cancelled", "orderId": 8}	\N	2026-09-04 16:00:03.143949+00
75	794	order_status	Commande annulée ❌	Votre commande a été annulée.	{"status": "cancelled", "orderId": 11}	\N	2026-09-04 16:00:08.946557+00
76	914	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 15}	\N	2026-09-04 17:11:25.321043+00
77	815	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 16}	\N	2026-09-04 17:14:55.741818+00
78	815	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 16}	\N	2026-09-04 17:15:21.147128+00
79	815	order_status	Commande confirmée ✅	Smash's Burger Oujda confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 16}	\N	2026-09-04 17:15:40.501991+00
80	815	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 16}	\N	2026-09-04 17:16:19.073946+00
81	815	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 16}	\N	2026-09-04 17:16:26.581802+00
82	815	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 17}	\N	2026-09-04 17:18:06.175691+00
83	815	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 17}	\N	2026-09-04 17:18:34.719933+00
84	815	order_status	Commande confirmée ✅	Smash's Burger Oujda confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 17}	\N	2026-09-04 17:18:39.386855+00
85	815	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 17}	\N	2026-09-04 17:18:44.568373+00
86	815	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 17}	\N	2026-09-04 17:18:50.419906+00
87	914	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 18}	\N	2026-09-06 01:36:33.659067+00
88	914	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 18}	\N	2026-09-06 01:37:01.709868+00
89	914	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 18}	\N	2026-09-06 01:37:04.176867+00
90	914	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 18}	\N	2026-09-06 01:37:06.953282+00
91	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 19}	\N	2026-09-07 15:53:22.778109+00
92	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 20}	\N	2026-09-07 15:53:52.157857+00
93	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 21}	\N	2026-09-07 15:54:12.157754+00
94	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 19}	\N	2026-09-07 15:54:32.303383+00
95	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 19}	\N	2026-09-07 15:54:34.382628+00
96	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 19}	\N	2026-09-07 15:54:37.996041+00
97	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 20}	\N	2026-09-07 15:54:42.509984+00
98	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 20}	\N	2026-09-07 15:54:44.398159+00
99	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 20}	\N	2026-09-07 15:54:45.989489+00
100	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 21}	\N	2026-09-07 15:54:50.22001+00
101	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 21}	\N	2026-09-07 15:54:51.429852+00
102	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 21}	\N	2026-09-07 15:54:52.988592+00
103	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 22}	\N	2026-09-07 18:16:15.175629+00
104	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 22}	\N	2026-09-07 23:13:22.868563+00
105	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 22}	\N	2026-09-07 23:13:37.381119+00
106	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 22}	\N	2026-09-07 23:14:01.663838+00
107	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 23}	\N	2026-09-08 16:09:14.146587+00
108	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 24}	\N	2026-09-08 16:09:21.612974+00
109	1066	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 25}	\N	2026-09-08 16:09:28.669718+00
110	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 23}	\N	2026-09-08 16:09:41.704192+00
111	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 23}	\N	2026-09-08 16:09:44.100258+00
112	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 23}	\N	2026-09-08 16:09:46.389598+00
113	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 24}	\N	2026-09-08 16:09:51.306532+00
114	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 24}	\N	2026-09-08 16:09:53.389014+00
115	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 24}	\N	2026-09-08 16:09:56.815535+00
116	1066	order_status	Commande acceptée ✅	Smash's Burger Oujda a confirmé votre commande.	{"status": "accepted", "orderId": 25}	\N	2026-09-08 16:10:02.406067+00
117	1066	order_status	En préparation 🍳	Smash's Burger Oujda prépare votre commande.	{"status": "preparing", "orderId": 25}	\N	2026-09-08 16:10:04.340581+00
118	1066	order_status	Commande prête 🛍️	Un livreur va bientôt récupérer votre commande.	{"status": "ready", "orderId": 25}	\N	2026-09-08 16:10:07.236192+00
119	1320	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 26}	\N	2026-09-10 21:34:02.145353+00
120	1320	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 27}	\N	2026-09-10 21:36:45.530912+00
121	1320	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 28}	\N	2026-09-10 21:37:12.72801+00
122	1341	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 29}	\N	2026-09-11 13:58:19.282066+00
123	1341	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 30}	\N	2026-09-11 13:58:48.17542+00
124	1341	order_status	Commande reçue ✅	Votre commande a bien été reçue et est en attente de confirmation.	{"status": "pending", "orderId": 31}	\N	2026-09-11 16:43:49.483543+00
125	1341	order_status	Commande acceptée ✅	Smash's Burger & Chicken a confirmé votre commande.	{"status": "accepted", "orderId": 31}	\N	2026-09-11 16:44:03.901028+00
126	1341	order_status	Commande confirmée ✅	Smash's Burger & Chicken confirme la préparation de votre commande.	{"status": "confirmed", "orderId": 31}	\N	2026-09-11 16:44:34.261694+00
127	1341	order_status	En préparation 🍳	Smash's Burger & Chicken prépare votre commande.	{"status": "preparing", "orderId": 31}	\N	2026-09-11 16:44:47.132975+00
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.order_items (id, order_id, menu_item_id, menu_item_name, quantity, unit_price, total_price, selected_size, selected_size_price_adjustment, selected_extras) FROM stdin;
7	4	108	Eau Minerale	3	7	21	\N	0	\N
8	5	105	Oasis Tropical	1	20	20	\N	0	\N
9	5	55	Box Tenders	1	30	30	\N	0	["sans tomate","ajouter sauce"]
10	5	45	Dynamite Crunchy Chicken	1	65	65	Menu	15	["sans tomate","ajouter sauce"]
11	6	108	Eau Minerale	1	7	7	\N	0	\N
12	7	69	Wrapstar chick'n roll	1	40	40	Solo	0	\N
13	7	103	Schweppes Tonic	1	10	10	\N	0	\N
14	7	58	Nashvilles Tenders	1	30	30	\N	0	\N
15	7	58	Nashvilles Tenders	1	30	30	\N	0	["ajouter sauce"]
16	8	44	Smoky Smash’s	1	65	65	\N	0	\N
17	9	56	Box Pilons	1	35	35	\N	0	\N
18	10	107	Oulmes	3	10	30	\N	0	\N
19	10	105	Oasis Tropical	2	20	40	\N	0	\N
20	11	80	Shakes Fraise	1	25	25	\N	0	\N
21	11	83	Shakes Nutella	1	30	30	Solo	0	\N
22	12	64	Tacos Nuggets	1	40	40	\N	0	\N
23	12	52	Double Smoky Smash’s	1	80	80	\N	0	\N
24	13	81	Shakes Oreo	1	45	45	S	20	\N
25	14	73	Menu kids Cheeseburger	1	35	35	\N	0	\N
26	15	71	Menu kids Nuggets	1	35	35	\N	0	\N
27	15	72	Menu kids Mini Tacos	2	35	70	\N	0	\N
28	15	72	Menu kids Mini Tacos	2	35	70	\N	0	\N
29	16	76	Tiramisu	1	25	25	\N	0	\N
30	16	71	Menu kids Nuggets	1	35	35	\N	0	\N
31	17	52	Double Smoky Smash’s	1	80	80	Solo	0	\N
32	17	96	Glass Tropical	1	10	10	\N	0	\N
33	17	95	Fanta Orange	1	10	10	\N	0	\N
34	18	80	Shakes Fraise	3	25	75	\N	0	\N
35	18	81	Shakes Oreo	5	25	125	\N	0	\N
36	19	82	Shakes Lotus	3	25	75	\N	0	\N
37	20	78	Oreo	1	25	25	\N	0	\N
38	21	76	Tiramisu	1	25	25	\N	0	\N
39	22	76	Tiramisu	2	25	50	\N	0	\N
40	23	83	Shakes Nutella	3	30	90	\N	0	\N
41	24	76	Tiramisu	3	25	75	\N	0	\N
42	25	63	Tacos Poulet	3	35	105	\N	0	\N
43	26	110	Banane 1Kg	4	19.9	79.6	\N	0	\N
44	26	110	Banane 1Kg	4	19.9	79.6	\N	0	\N
45	27	76	Tiramisu	5	25	125	\N	0	\N
46	27	47	Golden Tiger	1	80	80	Menu	15	["sans tomate","ajouter sauce"]
47	28	83	Shakes Nutella	1	30	30	\N	0	\N
48	28	64	Tacos Nuggets	1	40	40	\N	0	\N
49	29	77	Lotus	1	25	25	\N	0	\N
50	30	109	Orange à jus 1Kg	1	7.9	7.9	\N	0	\N
51	31	52	Double Smoky Smash’s	1	80	80	\N	0	\N
52	31	50	Double Smash’s Classic	1	65	65	\N	0	\N
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orders (id, reference, user_id, restaurant_id, driver_id, restaurant_name, user_name, status, subtotal, delivery_fee, discount_amount, total, delivery_address, notes, estimated_delivery_time, kitchen_code, pickup_code, delivery_type, scheduled_for, is_contactless, proof_photo_url, promo_code, payment_method, driver_rating, driver_rating_comment, customer_rating, created_at, updated_at, currency, vat_rate, vat_amount, service_fee, commission_rate, merchant_earning, driver_earning, jatek_earning, refunded_amount, refunded_jatek_earning, pricing_version, pickup_code_expires_at, pickup_code_used_at) FROM stdin;
18	#CMD576524	914	10	\N	Smash's Burger Oujda	Teto4	ready	200	0	0	220	Centre-ville d'Oujda	\N	20	224	8463	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-06 01:36:33.371127+00	2026-09-06 01:37:06.788+00	MAD	0	0	20	0.1	200	0	20	0	0	2026-09-v2	2026-09-07 01:37:01.56+00	\N
9	#CMD381026	815	10	7	Smash's Burger Oujda	Client	cancelled	35	25	0	63.5	Centre-ville d'Oujda	\N	20	774	5537	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-03 15:49:55.463711+00	2026-09-04 15:59:34.441+00	MAD	0	0	3.5	0.1	35	25	3.5	63.5	3.5	2026-09-v2	\N	\N
6	#CMD513595	794	10	\N	Smash's Burger Oujda	Tf	cancelled	7	25	0	32.7	Boulevard Annakhil, Hay Debbane, Oujda	\N	20	315	6493	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-02 02:49:06.846068+00	2026-09-04 15:59:50.382+00	MAD	0	0	0.7	0.1	7	25	0.7	32.7	0.7	2026-09-v2	\N	\N
27	#CMD042465	1320	10	\N	Smash's Burger Oujda	Ttt	pending	205	0	0	225.5	Boulevard Fès, Hay Rabat, Oujda	Ttttest\n---\nOptions :\nGolden Tiger — x1 — Taille: Menu — Extras: sans tomate, ajouter sauce	20	\N	\N	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-10 21:36:45.182489+00	2026-09-10 21:36:45.28+00	MAD	0	0	20.5	0.1	205	0	20.5	0	0	2026-09-v2	\N	\N
7	#CMD133338	815	10	\N	Smash's Burger Oujda	Client	cancelled	110	25	0	146	Centre-ville d'Oujda	---\nOptions :\nWrapstar chick'n roll — x1 — Taille: Solo\nNashvilles Tenders — x1 — Extras: ajouter sauce	20	367	4373	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-02 13:36:30.85989+00	2026-09-04 15:59:57.153+00	MAD	0	0	11	0.1	110	25	11	0	0	2026-09-v2	\N	\N
16	#CMD872520	815	10	\N	Smash's Burger Oujda	Client	cancelled	60	25	0	91	Centre-ville d'Oujda	\N	20	934	0860	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-04 17:14:55.454575+00	2026-09-04 17:17:20.412+00	MAD	0	0	6	0.1	60	25	6	91	6	2026-09-v2	2026-09-05 17:15:20.974+00	\N
8	#CMD794783	1	10	\N	Smash's Burger Oujda	Admin Jatek	cancelled	65	25	0	96.5	Centre-ville d'Oujda	\N	20	665	8188	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-03 07:30:36.714662+00	2026-09-04 16:00:03.003+00	MAD	0	0	6.5	0.1	65	25	6.5	0	0	2026-09-v2	\N	\N
11	#CMD995394	794	10	\N	Smash's Burger Oujda	Tf	cancelled	55	25	0	85.5	Boulevard Annakhil, Hay Debbane, Oujda	---\nOptions :\nShakes Nutella — x1 — Taille: Solo	20	945	0293	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-04 02:31:41.082566+00	2026-09-04 16:00:08.784+00	MAD	0	0	5.5	0.1	55	25	5.5	0	0	2026-09-v2	\N	\N
24	#CMD757609	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	75	25	0	107.5	Centre-ville d'Oujda	\N	20	626	1970	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-08 16:09:21.314439+00	2026-09-08 16:09:56.661+00	MAD	0	0	7.5	0.1	75	25	7.5	0	0	2026-09-v2	2026-09-09 16:09:51.144+00	\N
12	#CMD112930	815	10	\N	Smash's Burger Oujda	Client	cancelled	120	25	0	157	Centre-ville d'Oujda	\N	20	191	5252	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-04 14:05:53.710475+00	2026-09-04 16:00:17.314+00	MAD	0	0	12	0.1	120	25	12	157	12	2026-09-v2	\N	\N
19	#CMD266157	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	75	25	0	107.5	Centre-ville d'Oujda	\N	20	085	0598	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-07 15:53:22.518393+00	2026-09-07 15:54:37.861+00	MAD	0	0	7.5	0.1	75	25	7.5	0	0	2026-09-v2	2026-09-08 15:54:32.169+00	\N
22	#CMD574133	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	50	25	0	80	Centre-ville d'Oujda	\N	20	743	2375	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-07 18:16:14.864629+00	2026-09-07 23:14:01.524+00	MAD	0	0	5	0.1	50	25	5	0	0	2026-09-v2	2026-09-08 23:13:22.727+00	\N
17	#CMD499884	815	10	\N	Smash's Burger Oujda	Client	ready	100	25	0	135	Centre-ville d'Oujda	---\nOptions :\nDouble Smoky Smash’s — x1 — Taille: Solo	20	447	3350	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-04 17:18:05.841691+00	2026-09-04 17:18:50.241+00	MAD	0	0	10	0.1	100	25	10	0	0	2026-09-v2	2026-09-05 17:18:34.539+00	\N
10	#CMD079145	794	10	8	Smash's Burger Oujda	Tf	cancelled	70	25	0	102	Boulevard Annakhil, Hay Debbane, Oujda	\N	20	641	1466	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-03 21:30:57.739645+00	2026-09-04 15:58:49.477+00	MAD	0	0	7	0.1	70	25	7	102	7	2026-09-v2	\N	\N
4	#CMD045259	794	10	6	Smash's Burger Oujda	Tf	cancelled	21	25	0	48.1	Centre-ville d'Oujda	\N	20	122	0380	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-02 02:42:11.476171+00	2026-09-04 15:59:04.737+00	MAD	0	0	2.1	0.1	21	25	2.1	0	0	2026-09-v2	\N	\N
13	#CMD930548	914	10	\N	Smash's Burger Oujda	Teto4	cancelled	45	25	0	74.5	Centre-ville d'Oujda	---\nOptions :\nShakes Oreo — x1 — Taille: S	20	176	8048	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-04 15:55:55.980402+00	2026-09-04 17:13:45.129+00	MAD	0	0	4.5	0.1	45	25	4.5	74.5	4.5	2026-09-v2	2026-09-05 15:58:18.871+00	\N
5	#CMD815057	794	10	5	Smash's Burger Oujda	Tf	cancelled	115	25	0	151.5	Boulevard Annakhil, Hay Debbane, Oujda	---\nOptions :\nBox Tenders — x1 — Extras: sans tomate, ajouter sauce\nDynamite Crunchy Chicken — x1 — Taille: Menu — Extras: sans tomate, ajouter sauce	20	436	9464	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-02 02:42:56.212763+00	2026-09-04 15:59:16.755+00	MAD	0	0	11.5	0.1	115	25	11.5	151.5	11.5	2026-09-v2	\N	\N
20	#CMD017794	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	25	25	0	52.5	Centre-ville d'Oujda	\N	20	687	9106	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-07 15:53:51.907821+00	2026-09-07 15:54:45.854+00	MAD	0	0	2.5	0.1	25	25	2.5	0	0	2026-09-v2	2026-09-08 15:54:42.372+00	\N
14	#CMD480671	914	10	\N	Smash's Burger Oujda	Teto4	cancelled	35	25	0	63.5	Centre-ville d'Oujda	\N	20	949	1891	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-04 15:56:14.00148+00	2026-09-04 17:14:01.734+00	MAD	0	0	3.5	0.1	35	25	3.5	63.5	3.5	2026-09-v2	2026-09-05 15:58:07.122+00	\N
15	#CMD467998	914	10	8	Smash's Burger Oujda	Teto4	cancelled	175	0	0	192.5	Centre-ville d'Oujda	\N	20	064	3979	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-04 15:56:34.917776+00	2026-09-04 17:14:21.934+00	MAD	0	0	17.5	0.1	175	0	17.5	192.5	17.5	2026-09-v2	2026-09-05 15:57:54.336+00	\N
28	#CMD476648	1320	10	\N	Smash's Burger Oujda	Ttt	pending	70	25	0	102	Boulevard Fès, Hay Rabat, Oujda	\N	20	\N	\N	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-10 21:37:12.404528+00	2026-09-10 21:37:12.404528+00	MAD	0	0	7	0.1	70	25	7	0	0	2026-09-v2	\N	\N
21	#CMD266045	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	25	25	0	52.5	Centre-ville d'Oujda	\N	20	890	0060	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-07 15:54:11.9028+00	2026-09-07 15:54:52.807+00	MAD	0	0	2.5	0.1	25	25	2.5	0	0	2026-09-v2	2026-09-08 15:54:50.085+00	\N
29	#CMD008110	1341	10	\N	Smash's Burger Oujda	Medtestee	pending	25	25	0	52.5	Centre-ville d'Oujda	\N	20	\N	\N	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-11 13:58:18.933774+00	2026-09-11 13:58:18.933774+00	MAD	0	0	2.5	0.1	25	25	2.5	0	0	2026-09-v2	\N	\N
23	#CMD923337	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	90	25	0	124	Centre-ville d'Oujda	\N	20	495	6304	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-08 16:09:13.834118+00	2026-09-08 16:09:46.23+00	MAD	0	0	9	0.1	90	25	9	0	0	2026-09-v2	2026-09-09 16:09:41.536+00	\N
30	#CMD158173	1341	11	\N	Marjane Market	Medtestee	pending	7.9	10	0	18.3	Centre-ville d'Oujda	\N	20	\N	\N	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-11 13:58:47.920221+00	2026-09-11 13:58:47.920221+00	MAD	0	0	0.4	0.05	7.9	10	0.4	0	0	2026-09-v2	\N	\N
25	#CMD473867	1066	10	\N	Smash's Burger Oujda	Tvwnq	ready	105	25	0	140.5	Centre-ville d'Oujda	\N	20	550	2638	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-08 16:09:28.365643+00	2026-09-08 16:10:07.059+00	MAD	0	0	10.5	0.1	105	25	10.5	0	0	2026-09-v2	2026-09-09 16:10:02.242+00	\N
26	#CMD278735	1320	11	\N	Marjane Market	Ttt	pending	159.2	0	0	167.16	Centre-ville d'Oujda	\N	20	\N	\N	asap	\N	f	\N	\N	card	\N	\N	\N	2026-09-10 21:34:01.865207+00	2026-09-10 21:34:01.865207+00	MAD	0	0	7.96	0.05	159.2	0	7.96	0	0	2026-09-v2	\N	\N
31	#CMD024780	1341	10	\N	Smash's Burger & Chicken	Medtestee	preparing	145	25	0	184.5	Centre-ville d'Oujda	\N	20	249	5793	asap	\N	f	\N	\N	cash	\N	\N	\N	2026-09-11 16:43:49.249399+00	2026-09-11 16:44:46.963+00	MAD	0	0	14.5	0.1	145	25	14.5	0	0	2026-09-v2	2026-09-12 16:44:03.791+00	\N
\.


--
-- Data for Name: otp_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.otp_codes (id, phone, code, expires_at, attempts, used, created_at) FROM stdin;
1	+212600000001	431736	2026-08-05 16:02:35.547+00	0	f	2026-08-05 15:57:35.548081+00
2	+212699000099	286136	2026-08-05 16:05:02.831+00	0	f	2026-08-05 16:00:02.832874+00
3	testclient.jatek@yopmail.com	765577	2026-08-05 16:05:33.518+00	0	f	2026-08-05 16:00:33.519002+00
4	+33612195931	202414	2026-08-06 00:01:03.409+00	0	f	2026-08-05 23:56:03.410772+00
5	+33780726015	416372	2026-08-06 00:16:22.466+00	0	f	2026-08-06 00:11:22.467711+00
6	+33780726015	332120	2026-08-06 00:34:30.337+00	0	f	2026-08-06 00:29:30.33804+00
7	+33780726015	959513	2026-08-06 00:37:05.915+00	0	f	2026-08-06 00:32:05.916722+00
8	+212600000000	886886	2026-08-13 22:37:05.62+00	0	f	2026-08-13 22:32:05.621739+00
9	test@straight-path.fr	$2b$10$W/KgJdOEh57rbTZO6pN5SedGDve5/zr4EnCLRznp92JoCxfeivhzi	2026-09-02 02:46:39.451+00	0	t	2026-09-02 02:41:39.575045+00
10	jatek.app@gmail.com	$2b$10$xsIoPtifU799WziEfsTxw.ibhhuRJpzKBWfKcX2axbLy6VR2YFtPS	2026-09-02 13:40:47.978+00	1	t	2026-09-02 13:35:48.081443+00
12	jatek.app@gmail.com	$2b$10$UrRSOgknQR/ncDJ/vUxkQ.D9zkfWnaORcK1eqdzdEveiABHw42R8K	2026-09-04 14:09:41.615+00	0	t	2026-09-04 14:04:41.717638+00
13	teto@straight-path.fr	$2b$10$DKdz3nAoALDJPZPeI/5xqOXo19teAyS6H7VlHOso/QeIgKQv6mFI.	2026-09-04 16:00:14.388+00	0	t	2026-09-04 15:55:14.53721+00
14	test9@straight-path.fr	$2b$10$K3wOBVaF2OD5xH./Zp33HOjGq17fsEjIinFun/NRtrMpHZ2mM4OC.	2026-09-07 15:57:49.096+00	0	t	2026-09-07 15:52:49.202414+00
15	test1009@straight-path.fr	$2b$10$NzzYT3wt2cKNaPgLY533IOW2f8MBQzsJVxCQf49PKEZm9JBDZ9H8a	2026-09-10 21:37:48.934+00	0	t	2026-09-10 21:32:49.059278+00
16	test1009@straight-path.fr	693854	2026-09-10 21:40:27.064+00	0	t	2026-09-10 21:35:27.075437+00
17	jatek.app@gmail.com	$2b$10$AXMJzFpH.zceYhtasC5dxewLuKv6VAcqWnS3DHROShsUFl1vO5Bzi	2026-09-11 13:54:10.601+00	0	t	2026-09-11 13:49:10.730873+00
19	jatek.app@gmail.com	$2b$10$uoJjNhfVu446Ferzrq7Uv.pCGPl0fLKCRVUSFJpfvNO4TzQ60daw2	2026-09-11 13:56:47.793+00	0	t	2026-09-11 13:51:47.903233+00
20	rbelmahi90@gmail.com	$2b$10$vxjULWpjQDGKJwzCKV6usO6laHj2VGXMs6imzo7/eoHrUBaUYnyZC	2026-09-12 03:11:29.192+00	1	t	2026-09-12 03:06:29.330121+00
\.


--
-- Data for Name: payment_methods; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_methods (id, user_id, type, label, last4, brand, is_default, created_at) FROM stdin;
\.


--
-- Data for Name: platform_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.platform_settings (id, data, updated_at) FROM stdin;
1	{"city": "Oujda", "appName": "Jatek", "taxRate": "0.20", "currency": "MAD", "supportEmail": "support@jatek.ma", "supportPhone": "+212600000000", "minOrderAmount": "30", "defaultLatitude": "34.6814", "maintenanceMode": false, "defaultLongitude": "-1.9078", "defaultDeliveryFee": "15", "maxDeliveryRadiusKm": "10", "driverCommissionRate": "0.15", "freeDeliveryThreshold": "150", "orderNotificationsEnabled": true}	2026-08-03 23:27:25.964902+00
\.


--
-- Data for Name: promo_code_usages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promo_code_usages (id, promo_code_id, user_id, order_id, discount_amount, created_at) FROM stdin;
\.


--
-- Data for Name: promo_codes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promo_codes (id, code, description, type, value, min_order_amount, max_uses, used_count, max_uses_per_user, first_order_only, restaurant_id, is_active, expires_at, created_at) FROM stdin;
1	TESTCODEPROM	Test description code promo	percentage	30	80	1	0	1	f	\N	t	\N	2026-07-19 16:02:44.847437+00
\.


--
-- Data for Name: quotes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.quotes (id, user_id, restaurant_id, restaurant_name, user_name, user_phone, subject, description, status, quoted_amount, merchant_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: referrals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.referrals (id, referrer_id, referred_id, code, status, credit_amount, referred_credit_amount, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refunds (id, order_id, user_id, amount, reason, type, admin_id, admin_name, notes, created_at) FROM stdin;
\.


--
-- Data for Name: restaurant_hours; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurant_hours (id, restaurant_id, day_of_week, open_time, close_time, is_closed, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: restaurants; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.restaurants (id, owner_id, name, description, address, phone, image_url, cover_image_url, logo_url, category, business_type, is_local, is_open, delivery_time, delivery_fee, minimum_order, rating, review_count, is_verified, click_count, legal_name, ice, printer_email, profile_completed_at, created_at, updated_at, latitude, longitude, is_featured, subcategory_id, free_delivery_threshold, commission_rate) FROM stdin;
10	1	Smash's Burger & Chicken	Burgers, poulet croustillant, tacos, wraps et desserts Smash's à Oujda.	693 Boulevard Al Maqdis, Hay Al Qods, Oujda 60000	\N	/api/storage/objects/images/13b0c01e-c7a0-4a61-a51c-dea72e5b17e4	/api/storage/objects/banners/6e0dadf2-27ce-4cbe-b2c6-b63e8106ed96	/api/storage/objects/logos/80e23a41-d747-42a5-a75a-b7edb4c7d692	Restauration	restaurant	t	t	20	25	50	\N	0	t	1	\N	\N	\N	2026-09-11 16:40:46.053+00	2026-08-22 00:35:39.126607+00	2026-09-11 16:40:46.053+00	34.6814	-1.9078	t	\N	150	0.1
11	1	Marjane Market	Des sacs supplémentaires peuvent être ajoutés à votre commande selon le volume de vos achats	Oujda	\N	/api/storage/objects/banners/fa857e1a-35ba-4c1f-87b2-a2c8b302a150	\N	/api/storage/objects/logos/044427f6-05e2-4e0a-9236-0bbef2a9bb3e	Supermarche	supermarket	f	t	20	10	50	\N	0	t	1	Marjane Market	\N	\N	2026-09-14 01:01:13.68+00	2026-09-07 19:08:48.398956+00	2026-09-14 01:01:13.681+00	34.6814	-1.9078	t	77	150	0.05
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, user_id, restaurant_id, order_id, user_name, rating, comment, created_at) FROM stdin;
\.


--
-- Data for Name: shorts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shorts (id, title, image_url, video_url, restaurant_id, restaurant_name, is_active, sort_order, created_at, updated_at, audio_codec, audio_bitrate, duration_seconds) FROM stdin;
23	Marjane Market	/api/storage/objects/shorts/19c8a952-aa2c-4a6f-ae7e-0ff8558b7775	https://www.youtube.com/watch?v=VQsRtAHcMCE	11	Marjane Market	t	3	2026-09-02 13:33:45.787626+00	2026-09-11 16:33:38.955+00	\N	\N	\N
19	Nashville	/api/storage/objects/shorts/fbbc0d00-f4b4-4d4d-95d5-2e9c0cf152ed	https://www.youtube.com/watch?v=Z19hajAeBtg	10	Smash's Burger Oujda	t	1	2026-08-22 00:35:39.126607+00	2026-09-11 16:33:58.743+00	\N	\N	\N
24	Samshs	/api/storage/objects/shorts/32444221-f571-4307-8040-b976d450ebc4	https://www.youtube.com/watch?v=rwpcBTC9zzI	10	Smash's Burger Oujda	t	2	2026-09-11 16:37:09.187541+00	2026-09-11 16:37:09.187541+00	\N	\N	\N
\.


--
-- Data for Name: support_tickets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.support_tickets (id, user_id, category, subject, message, status, created_at) FROM stdin;
1	794	order	Ttgj	B’kj	open	2026-09-03 21:30:07.684383+00
2	794	order	Hcb	Ygyu	in_progress	2026-09-03 21:30:36.941153+00
\.


--
-- Data for Name: user_consents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_consents (user_id, cookies_essential, cookies_analytics, cookies_marketing, data_processing, data_sharing, personalization, marketing_emails, marketing_sms, marketing_push, terms_version, terms_accepted_at, privacy_version, privacy_accepted_at, cookies_version, cookies_accepted_at, updated_at) FROM stdin;
794	t	t	t	t	t	t	t	t	t	2026-04	2026-09-07 00:16:46.034+00	2026-04	2026-09-07 00:16:46.034+00	2026-04	2026-09-07 00:16:46.034+00	2026-09-07 00:16:46.034+00
1066	t	t	t	t	t	t	t	t	t	2026-04	2026-09-11 23:50:27.492+00	2026-04	2026-09-11 23:50:27.492+00	2026-04	2026-09-11 23:50:27.492+00	2026-09-11 23:50:27.492+00
1341	t	t	t	t	t	t	t	t	t	2026-04	2026-09-12 11:20:24.175+00	2026-04	2026-09-12 11:20:24.175+00	2026-04	2026-09-12 11:20:24.175+00	2026-09-12 11:20:24.175+00
914	t	t	t	t	t	t	t	t	t	2026-04	2026-09-12 11:38:15.26+00	2026-04	2026-09-12 11:38:15.26+00	2026-04	2026-09-12 11:38:15.26+00	2026-09-12 11:38:15.26+00
11	t	t	t	t	t	t	t	t	t	2026-04	2026-09-12 12:31:12.491+00	2026-04	2026-09-12 12:31:12.491+00	2026-04	2026-09-12 12:31:12.491+00	2026-09-12 12:31:12.491+00
1	t	t	t	t	t	t	t	t	t	2026-04	2026-09-13 12:15:26.239+00	2026-04	2026-09-13 12:15:26.239+00	2026-04	2026-09-13 12:15:26.239+00	2026-09-13 12:15:26.241+00
1320	t	t	t	t	t	t	t	t	t	2026-04	2026-09-10 21:36:23.781+00	2026-04	2026-09-10 21:36:23.781+00	2026-04	2026-09-10 21:36:23.781+00	2026-09-10 21:36:23.781+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, name, email, password, role, phone, address, avatar_url, is_active, loyalty_points, wallet_balance, referral_code, referred_by, assigned_shop_id, permissions, created_at, updated_at) FROM stdin;
2	Test Client Jatek	testclient@jatek.ma	$2b$10$qAhRa6GQJoB.ycNN66deZeuhAmJ2aAvcK7adjN/a87F.dvrj.bfvK	customer	+212600000099	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-19 12:06:24.446361+00	2026-07-19 12:06:24.446361+00
10	Belmahi Rachid	r.belmahi@gmail.com	$2b$10$AemdfpUlozKYgY/dkQw7z.JBPJ2ed.K7DxSFKr.wgjJQlFcYooSpW	admin	+212600000001	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-19 16:02:43.080942+00	2026-07-19 16:02:43.080942+00
15	Riad Belmahi	myjantespwa@gmail.com	$2b$10$GZoM/Zw6OTWx7yjJb5ffb.1B0N0AiFCKfBzutUtio18nXL0IRkT6q	admin	0780726015	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-19 18:01:48.244948+00	2026-07-19 18:01:48.244948+00
11	Belmahi Rachid Super	rbelmahi90@gmail.com	$2b$10$COhm3ScTYK/j8qW0SIV1SeYhoiDZPQopxeLlAmdkH7eYVlXiBfSRC	super_admin	+212600000002	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-19 16:02:43.08678+00	2026-07-19 18:02:17.776+00
28	Smoke Tester	smoketest@jatek.ma	$2b$10$ydSDXw0ijMk3oeV22y6/VeTF5nDXrG/tlasObyyLH7XzKv/6MoOSa	customer	+212699999998	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-20 01:33:48.999791+00	2026-07-20 01:33:48.999791+00
31	Owner Smoke	ownersmoke@jatek.ma	$2b$10$qrrwaGuL0Wt4qPuZuZ8RDuPxlYQLCC4IuJQshJM11B2xSly2toA92	owner	+212699999997	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-20 01:36:48.79726+00	2026-07-20 01:36:48.79726+00
425	E2E Client Test	e2e-1786303290213@test.jatek.ma	$2b$10$ttz0zhqlcGVNmcC.s.QVr.pmI9r6aStw5kzMIP3u3wDcmy9R0bAlu	customer	\N	\N	\N	t	20	0	\N	\N	\N	\N	2026-08-09 19:21:30.288319+00	2026-08-09 19:21:30.415+00
426	E2E Client Test	e2e-1786303324763@test.jatek.ma	$2b$10$/B4BMncTsRhgohgPWnG4A.Kky5Yl26m7TcehTSoyNE5PRNS1BEnqe	customer	\N	\N	\N	t	20	0	\N	\N	\N	\N	2026-08-09 19:22:04.833622+00	2026-08-09 19:22:04.907+00
650	Smashs Owner	owner@straight-path.fr	$2b$10$i/HYMT4vQTbs/NXjXHs2NO7FQpGsL66ei6vuZR5J.75IkD30F01vm	restaurant_owner	\N	\N	\N	t	0	0	\N	\N	\N	\N	2026-08-22 01:36:58.472232+00	2026-08-22 01:36:58.472232+00
794	Tf	test@straight-path.fr	$2b$10$U4kTJr2nLZSmhmkSGejIj.vusLf4Xr.S9a/LaMPJy9per22W7PbM2	customer	\N	\N	\N	t	40	286.2	\N	\N	\N	\N	2026-09-02 02:42:05.180702+00	2026-09-04 15:59:50.354+00
1320	Ttt	test1009@straight-path.fr	$2b$10$v/4Lurl4IkgbQW.GqfM2AOzNNQRsONhDHDh7eyjL62juw0NvqYASi	customer	\N	\N	\N	t	48	0	\N	\N	\N	\N	2026-09-10 21:33:45.747943+00	2026-09-10 21:37:12.514+00
905	Fahrer	medbaouch75@gmail.com	$2b$12$dlnczLXMXhYGTX7PZ6UcqevtnPOdvzmDc.6QxshfFyPAz73rurLla	driver	+212666711202	\N	\N	t	0	0	\N	\N	\N	\N	2026-09-04 14:01:15.224767+00	2026-09-04 17:10:27.022+00
9	Livreur Test 1	livtest1@straight-path.fr	$2b$12$iEVLmVtxkJQt/qQ/tc37A.7USVlciVjD1hnq9mC8Rpa1wpzrZ3ri.	driver	+212600000001	\N	\N	t	0	0	\N	\N	\N	\N	2026-07-19 16:01:21.039303+00	2026-09-02 08:43:56.522+00
844	Driv9@straight-path.fr	driv9@straight-path.fr	$2b$12$/n848y9tu5LAF3Njh7HGgOoliJCyfkIg1TKLi0sP5.zw6RkmpBWKK	driver	+33780726017	\N	\N	t	0	0	\N	\N	\N	\N	2026-09-03 12:50:21.929196+00	2026-09-03 19:58:02.629+00
876	Driv10@straight-path.fr	driv10@straight-path.fr	$2b$10$gIMXkm5iGKEk6qJ5FPxjfefNaB0kMSU7vYs6cJIUgkFUV0i6gDKmG	driver	+33780726013	\N	\N	t	0	0	\N	\N	\N	\N	2026-09-03 23:38:13.834738+00	2026-09-03 23:38:13.834738+00
914	Teto4	teto@straight-path.fr	$2b$10$LXxM6HbvNVq.PnA6oMIyMeV8Rii3GxXiqah4TiFVsP7JYp2pQcYP6	customer	\N	\N	\N	t	54	330.5	\N	\N	\N	\N	2026-09-04 15:55:42.310765+00	2026-09-06 01:36:33.467+00
651	Driv6	driv6@straight-path.fr	$2b$12$hqHz2A67XWDyg03/OnLzL./rB/3iSh3vAhNbQetpQcGg9L7xqwnoK	driver	+33780726015	\N	\N	t	0	0	\N	\N	\N	\N	2026-08-22 01:37:35.92151+00	2026-09-07 15:51:10.141+00
1341	Medtester	jatek.app@gmail.com	$2b$12$MVbHH9VjzbV2F1mqSA5obehtW1VHfc3ketMAPml9Te.K3MRHbZAl2	customer			\N	t	24	0	\N	\N	\N	\N	2026-09-11 13:52:08.979601+00	2026-09-11 17:25:36.49+00
1	Admin Jatek	admin@jatek.ma	$2b$10$JOUV9W7DwTEuMDrNqF1r0.StN1IuynxobbgYk2PZGg7S.gQGf29PG	super_admin	+212600000000	\N	\N	t	9	0	\N	\N	\N	\N	2026-07-19 12:06:24.359115+00	2026-09-03 07:30:36.784+00
1065	Driv3@straight-path.fr	driv3@straight-path.fr	$2b$12$uVEsgTEpCwdjBtJZgkhLtOg49/DytNVUtljlk2iccxLZ87EeR0Arm	driver	+33780726010	\N	\N	t	0	0	\N	\N	\N	\N	2026-09-07 15:51:38.741664+00	2026-09-14 01:01:50.007+00
1066	Tvwnq	test9@straight-path.fr	$2b$10$JOUV9W7DwTEuMDrNqF1r0.StN1IuynxobbgYk2PZGg7S.gQGf29PG	customer	\N	\N	\N	t	64	0	\N	\N	\N	\N	2026-09-07 15:53:17.871544+00	2026-09-08 16:09:28.464+00
\.


--
-- Name: replit_database_migrations_v1_id_seq; Type: SEQUENCE SET; Schema: _system; Owner: -
--

SELECT pg_catalog.setval('_system.replit_database_migrations_v1_id_seq', 3, true);


--
-- Name: activity_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_logs_id_seq', 32, true);


--
-- Name: addresses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.addresses_id_seq', 2, true);


--
-- Name: ads_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ads_id_seq', 19, true);


--
-- Name: cart_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.cart_items_id_seq', 1, false);


--
-- Name: carts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.carts_id_seq', 1, false);


--
-- Name: categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.categories_id_seq', 78, true);


--
-- Name: chat_messages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.chat_messages_id_seq', 1, false);


--
-- Name: dashboard_todos_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dashboard_todos_id_seq', 1, false);


--
-- Name: drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.drivers_id_seq', 9, true);


--
-- Name: favorites_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.favorites_id_seq', 1, true);


--
-- Name: menu_item_categories_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_item_categories_id_seq', 38, true);


--
-- Name: menu_item_extras_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_item_extras_id_seq', 98, true);


--
-- Name: menu_item_sizes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_item_sizes_id_seq', 50, true);


--
-- Name: menu_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.menu_items_id_seq', 110, true);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.notifications_id_seq', 127, true);


--
-- Name: order_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.order_items_id_seq', 52, true);


--
-- Name: orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.orders_id_seq', 31, true);


--
-- Name: otp_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.otp_codes_id_seq', 20, true);


--
-- Name: payment_methods_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.payment_methods_id_seq', 1, false);


--
-- Name: platform_settings_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.platform_settings_id_seq', 1, false);


--
-- Name: promo_code_usages_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promo_code_usages_id_seq', 1, false);


--
-- Name: promo_codes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promo_codes_id_seq', 1, true);


--
-- Name: quotes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.quotes_id_seq', 1, false);


--
-- Name: referrals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.referrals_id_seq', 1, false);


--
-- Name: refunds_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.refunds_id_seq', 1, false);


--
-- Name: restaurant_hours_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurant_hours_id_seq', 1, false);


--
-- Name: restaurants_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.restaurants_id_seq', 11, true);


--
-- Name: reviews_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reviews_id_seq', 3, true);


--
-- Name: shorts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.shorts_id_seq', 24, true);


--
-- Name: support_tickets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.support_tickets_id_seq', 2, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_id_seq', 1519, true);


--
-- Name: replit_database_migrations_v1 replit_database_migrations_v1_pkey; Type: CONSTRAINT; Schema: _system; Owner: -
--

ALTER TABLE ONLY _system.replit_database_migrations_v1
    ADD CONSTRAINT replit_database_migrations_v1_pkey PRIMARY KEY (id);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: addresses addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_pkey PRIMARY KEY (id);


--
-- Name: ads ads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ads
    ADD CONSTRAINT ads_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (key);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: carts carts_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_unique UNIQUE (user_id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_unique UNIQUE (slug);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: dashboard_todos dashboard_todos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dashboard_todos
    ADD CONSTRAINT dashboard_todos_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_user_id_unique UNIQUE (user_id);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (id);


--
-- Name: menu_item_categories menu_item_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_categories
    ADD CONSTRAINT menu_item_categories_pkey PRIMARY KEY (id);


--
-- Name: menu_item_extras menu_item_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_extras
    ADD CONSTRAINT menu_item_extras_pkey PRIMARY KEY (id);


--
-- Name: menu_item_sizes menu_item_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_sizes
    ADD CONSTRAINT menu_item_sizes_pkey PRIMARY KEY (id);


--
-- Name: menu_items menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_items
    ADD CONSTRAINT menu_items_pkey PRIMARY KEY (id);


--
-- Name: notification_prefs notification_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_prefs
    ADD CONSTRAINT notification_prefs_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: orders orders_reference_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_reference_unique UNIQUE (reference);


--
-- Name: otp_codes otp_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.otp_codes
    ADD CONSTRAINT otp_codes_pkey PRIMARY KEY (id);


--
-- Name: payment_methods payment_methods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_pkey PRIMARY KEY (id);


--
-- Name: platform_settings platform_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_settings
    ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);


--
-- Name: promo_code_usages promo_code_usages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_code_usages
    ADD CONSTRAINT promo_code_usages_pkey PRIMARY KEY (id);


--
-- Name: promo_codes promo_codes_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_code_unique UNIQUE (code);


--
-- Name: promo_codes promo_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promo_codes
    ADD CONSTRAINT promo_codes_pkey PRIMARY KEY (id);


--
-- Name: quotes quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quotes
    ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);


--
-- Name: referrals referrals_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_code_unique UNIQUE (code);


--
-- Name: referrals referrals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.referrals
    ADD CONSTRAINT referrals_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: restaurant_hours restaurant_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_hours
    ADD CONSTRAINT restaurant_hours_pkey PRIMARY KEY (id);


--
-- Name: restaurants restaurants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurants
    ADD CONSTRAINT restaurants_pkey PRIMARY KEY (id);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: shorts shorts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shorts
    ADD CONSTRAINT shorts_pkey PRIMARY KEY (id);


--
-- Name: support_tickets support_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_pkey PRIMARY KEY (id);


--
-- Name: user_consents user_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_pkey PRIMARY KEY (user_id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_referral_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_referral_code_unique UNIQUE (referral_code);


--
-- Name: idx_replit_database_migrations_v1_build_id; Type: INDEX; Schema: _system; Owner: -
--

CREATE UNIQUE INDEX idx_replit_database_migrations_v1_build_id ON _system.replit_database_migrations_v1 USING btree (build_id);


--
-- Name: favorites_user_restaurant_uniq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX favorites_user_restaurant_uniq ON public.favorites USING btree (user_id, restaurant_id);


--
-- Name: idx_activity_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_action ON public.activity_logs USING btree (action);


--
-- Name: idx_activity_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_created_at ON public.activity_logs USING btree (created_at);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs USING btree (user_id);


--
-- Name: idx_menu_item_extras_menu_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_item_extras_menu_item_id ON public.menu_item_extras USING btree (menu_item_id);


--
-- Name: idx_menu_item_sizes_menu_item_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_menu_item_sizes_menu_item_id ON public.menu_item_sizes USING btree (menu_item_id);


--
-- Name: idx_restaurant_hours_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_restaurant_hours_unique ON public.restaurant_hours USING btree (restaurant_id, day_of_week);


--
-- Name: addresses addresses_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.addresses
    ADD CONSTRAINT addresses_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_cart_id_carts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_cart_id_carts_id_fk FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_menu_item_id_menu_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cart_items
    ADD CONSTRAINT cart_items_menu_item_id_menu_items_id_fk FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE RESTRICT;


--
-- Name: carts carts_restaurant_id_restaurants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_restaurant_id_restaurants_id_fk FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE RESTRICT;


--
-- Name: carts carts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carts
    ADD CONSTRAINT carts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_restaurant_id_restaurants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_restaurant_id_restaurants_id_fk FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: menu_item_extras menu_item_extras_menu_item_id_menu_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_extras
    ADD CONSTRAINT menu_item_extras_menu_item_id_menu_items_id_fk FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: menu_item_sizes menu_item_sizes_menu_item_id_menu_items_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.menu_item_sizes
    ADD CONSTRAINT menu_item_sizes_menu_item_id_menu_items_id_fk FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE CASCADE;


--
-- Name: notification_prefs notification_prefs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_prefs
    ADD CONSTRAINT notification_prefs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payment_methods payment_methods_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT payment_methods_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: restaurant_hours restaurant_hours_restaurant_id_restaurants_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.restaurant_hours
    ADD CONSTRAINT restaurant_hours_restaurant_id_restaurants_id_fk FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;


--
-- Name: support_tickets support_tickets_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_tickets
    ADD CONSTRAINT support_tickets_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_consents user_consents_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_consents
    ADD CONSTRAINT user_consents_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict BD2Hj5Z77kdSjQviAP3vDOFYihOxRdAFm6QMDO6TjaZsZaNSrAf8hYgvbeqgW6n

