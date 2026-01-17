-- =====================================================
-- UPDATE SITE CITIES
-- Populates city column based on address analysis
-- City determines fulfillment messaging:
--   HARARE → "Ready for collection at Head Office"
--   OTHER  → "Order will be dispatched/mailed"
-- =====================================================

-- HARARE METROPOLITAN (includes Chitungwiza, Ruwa - Greater Harare)
UPDATE sites SET city = 'Harare' WHERE site_code IN (
  'ARDBENNIE-DEPOT',
  'ARDBENNIE-SS',
  'AVONDALE',
  'BELVEDERE',
  'CHACHA',           -- Chitungwiza (Greater Harare)
  'CHIKWANHA',        -- Chitungwiza
  'CHITUNGWIZA',      -- Chitungwiza
  'COLNE-VALLEY',
  'DERBYSHIRE',
  'GAYSDON',
  'GLAUDINA',
  'GREENCROFT',
  'HATFIELD',
  'HAZICLIFFE',
  'HAZLCLIFFE-1ST',
  'LIBERATION-CITY',
  'MSSA',
  'MBARE',
  'MOUNT-PLEASANT',
  'MURCHIWA',
  'NEMO',
  'OK-MART',
  'POMONA',
  'RUWA-MAVAMBO',     -- Ruwa (Greater Harare)
  'SECOND-STREET',
  'SEKE',
  'SEVENTH-STREET',
  'SKYWAY',
  'UMWINSIDALE',
  'WARREN-HILLS',
  'WESGATE',
  'WORKINGTON',
  'ZINDOGA'
);

-- BULAWAYO
UPDATE sites SET city = 'Bulawayo' WHERE site_code IN (
  'BELLEVUE',
  'FIFE-STREET',
  'LOBENGULA-STREET',
  'LUVEVE',
  'MAKOKOBO',
  'SOUTHSIDE'
);

-- GWERU
UPDATE sites SET city = 'Gweru' WHERE site_code IN (
  'DABUKA-DEPOT',
  'GWERU'
);

-- MASVINGO
UPDATE sites SET city = 'Masvingo' WHERE site_code IN (
  'MASVINGO-CIPSHAM',
  'MASVINGO-PANGOLIN',
  'NYIKA'
);

-- MUTARE
UPDATE sites SET city = 'Mutare' WHERE site_code IN (
  'MUTARE-FLYOVER'
);

-- KADOMA
UPDATE sites SET city = 'Kadoma' WHERE site_code IN (
  'KADOMA-CBD',
  'KADOMA-HIGHWAY'
);

-- KWEKWE
UPDATE sites SET city = 'Kwekwe' WHERE site_code IN (
  'KWEKWE-ARMAN'
);

-- ZVISHAVANE
UPDATE sites SET city = 'Zvishavane' WHERE site_code IN (
  'MANDAVA',
  'ZVISHAVANE'
);

-- CHINHOYI
UPDATE sites SET city = 'Chinhoyi' WHERE site_code IN (
  'CHINHOYI'
);

-- BINDURA
UPDATE sites SET city = 'Bindura' WHERE site_code IN (
  'BINDURA'
);

-- KAROI
UPDATE sites SET city = 'Karoi' WHERE site_code IN (
  'KAROI-TRUCK'
);

-- KARIBA
UPDATE sites SET city = 'Kariba' WHERE site_code IN (
  'KARIBA'
);

-- MT DARWIN
UPDATE sites SET city = 'Mt Darwin' WHERE site_code IN (
  'MOUNT-DARWIN',
  'NYAMAHOBOGO'
);

-- MAZOWE
UPDATE sites SET city = 'Mazowe' WHERE site_code IN (
  'MAZOWE'
);

-- MVURWI
UPDATE sites SET city = 'Mvurwi' WHERE site_code IN (
  'MVURWI'
);

-- MUTOKO
UPDATE sites SET city = 'Mutoko' WHERE site_code IN (
  'MUTOKO'
);

-- RUSAPE
UPDATE sites SET city = 'Rusape' WHERE site_code IN (
  'RUSAPE'
);

-- HEADLANDS
UPDATE sites SET city = 'Headlands' WHERE site_code IN (
  'HEADLANDS'
);

-- CHIPINGE
UPDATE sites SET city = 'Chipinge' WHERE site_code IN (
  'CHIPINGE'
);

-- BEATRICE
UPDATE sites SET city = 'Beatrice' WHERE site_code IN (
  'BEATRICE'
);

-- BEITBRIDGE
UPDATE sites SET city = 'Beitbridge' WHERE site_code IN (
  'BEITBRIDGE'
);

-- CHIVHU
UPDATE sites SET city = 'Chivhu' WHERE site_code IN (
  'CHIVHU'
);

-- GOKWE
UPDATE sites SET city = 'Gokwe' WHERE site_code IN (
  'NEMBUDZIYA'
);

-- CHIWESHE
UPDATE sites SET city = 'Chiweshe' WHERE site_code IN (
  'NZVIMBO'
);

-- NGEZI (Zimplats mining area)
UPDATE sites SET city = 'Ngezi' WHERE site_code IN (
  'ZIMPLATS-DEPOT'
);

-- TRIANGLE
UPDATE sites SET city = 'Triangle' WHERE site_code IN (
  'TRIANGLE'
);

-- Verify all cities populated
SELECT city, COUNT(*) as site_count 
FROM sites 
GROUP BY city 
ORDER BY site_count DESC;
