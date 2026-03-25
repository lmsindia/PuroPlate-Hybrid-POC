--
-- PostgreSQL database dump
--

\restrict ZkklcsaPeBDYRjltC8kkUbqHPbCSgbXePhEao12bc27bosLgBHn9WSmoLrjo807

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-03-25 14:28:59

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

DROP DATABASE IF EXISTS "PuroPlate";
--
-- TOC entry 5216 (class 1262 OID 16679)
-- Name: PuroPlate; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE "PuroPlate" WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'English_India.1252';


ALTER DATABASE "PuroPlate" OWNER TO postgres;

\unrestrict ZkklcsaPeBDYRjltC8kkUbqHPbCSgbXePhEao12bc27bosLgBHn9WSmoLrjo807
\connect "PuroPlate"
\restrict ZkklcsaPeBDYRjltC8kkUbqHPbCSgbXePhEao12bc27bosLgBHn9WSmoLrjo807

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5217 (class 0 OID 0)
-- Dependencies: 267
-- Name: vendor_payouts_id_seq; Type: SEQUENCE SET; Schema: marketplace; Owner: postgres
--

SELECT pg_catalog.setval('marketplace.vendor_payouts_id_seq', 1, false);


--
-- TOC entry 5218 (class 0 OID 0)
-- Dependencies: 259
-- Name: vendor_products_id_seq; Type: SEQUENCE SET; Schema: marketplace; Owner: postgres
--

SELECT pg_catalog.setval('marketplace.vendor_products_id_seq', 1, false);


--
-- TOC entry 5219 (class 0 OID 0)
-- Dependencies: 278
-- Name: vendor_shipping_rules_id_seq; Type: SEQUENCE SET; Schema: marketplace; Owner: postgres
--

SELECT pg_catalog.setval('marketplace.vendor_shipping_rules_id_seq', 1, false);


--
-- TOC entry 5220 (class 0 OID 0)
-- Dependencies: 276
-- Name: vendor_wallet_transactions_id_seq; Type: SEQUENCE SET; Schema: marketplace; Owner: postgres
--

SELECT pg_catalog.setval('marketplace.vendor_wallet_transactions_id_seq', 18, true);


--
-- TOC entry 5221 (class 0 OID 0)
-- Dependencies: 274
-- Name: vendor_wallets_id_seq; Type: SEQUENCE SET; Schema: marketplace; Owner: postgres
--

SELECT pg_catalog.setval('marketplace.vendor_wallets_id_seq', 3, true);


--
-- TOC entry 5222 (class 0 OID 0)
-- Dependencies: 255
-- Name: vendors_id_seq; Type: SEQUENCE SET; Schema: marketplace; Owner: postgres
--

SELECT pg_catalog.setval('marketplace.vendors_id_seq', 10, true);


-- Completed on 2026-03-25 14:28:59

--
-- PostgreSQL database dump complete
--

\unrestrict ZkklcsaPeBDYRjltC8kkUbqHPbCSgbXePhEao12bc27bosLgBHn9WSmoLrjo807

