-- ============================================
-- SEED CATALOGO ALIMENTARI  (~85 voci base)
-- name, aliases, category, unit, grammi per unita', kcal, proteine, carbo, grassi, fibre  (tutti per 100g)
-- Eseguire DOPO food_catalog.sql. Idempotente: puoi rilanciarlo.
-- ============================================

INSERT INTO food_catalog
  (name, aliases, category, unit_default, grams_per_unit, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g)
VALUES
-- Uova e ovoprodotti
('Uova', ARRAY['uovo','ovum','ovum','uova fresche'], 'Uova e ovoprodotti', 'pezzi', 50, 143, 12.6, 0.7, 9.5, 0),
('Albumi', ARRAY['albume','bianco d uovo'], 'Uova e ovoprodotti', 'pezzi', 33, 52, 11.6, 0.7, 0.1, 0),
('Tuorlo', ARRAY['rosso d uovo','tuorlo'], 'Uova e ovoprodotti', 'pezzi', 17, 352, 15.2, 3.4, 28.0, 0),
('Uovo di quaglia', ARRAY['quaglia'], 'Uova e ovoprodotti', 'pezzi', 10, 168, 13.0, 1.5, 11.0, 0),

-- Latte e latticini
('Latte intero', ARRAY['latte','latte fresco'], 'Latte e latticini', 'ml', 1, 61, 3.2, 4.6, 3.3, 0),
('Latte scremato', ARRAY['latte magro','skim'], 'Latte e latticini', 'ml', 1, 34, 3.4, 5.0, 0.2, 0),
('Latte parzialmente scremato', ARRAY['latte mezzo grasso'], 'Latte e latticini', 'ml', 1, 46, 3.3, 4.8, 1.7, 0),
('Latte di soia', ARRAY['soia','soj latte'], 'Latte e latticini', 'ml', 1, 43, 3.3, 4.9, 1.6, 0.5),
('Burro', ARRAY['burro dolce'], 'Latte e latticini', 'g', 1, 717, 0.9, 0.1, 81.1, 0),
('Parmigiano', ARRAY['parmigiano reggiano','grana padano'], 'Latte e latticini', 'g', 1, 392, 35.8, 3.2, 25.8, 0),
('Mozzarella', ARRAY['mozzarella fiordilatte'], 'Latte e latticini', 'g', 1, 300, 22.2, 2.2, 22.4, 0),
('Ricotta', ARRAY['ricotta di pecora'], 'Latte e latticini', 'g', 1, 174, 11.3, 3.3, 13.0, 0),
('Yogurt intero', ARRAY['yogurt','iogurt'], 'Latte e latticini', 'g', 1, 61, 3.5, 4.7, 3.1, 0),
('Yogurt greco', ARRAY['yogurt 0'], 'Latte e latticini', 'g', 1, 59, 10.0, 3.6, 0.4, 0),

-- Carne
('Petto di pollo', ARRAY['pollo','petto'], 'Carne', 'g', 1, 110, 23.0, 0.0, 1.9, 0),
('Coscia di pollo', ARRAY['coscia','pollo arrosto'], 'Carne', 'g', 1, 145, 19.0, 0.0, 8.0, 0),
('Pollo intero', ARRAY['gallina','pollo'], 'Carne', 'g', 1, 130, 21.0, 0.0, 5.0, 0),
('Manzo', ARRAY['vitello','manzo fresco'], 'Carne', 'g', 1, 190, 26.0, 0.0, 10.0, 0),
('Macinato misto', ARRAY['macinato','carne trita','ground beef'], 'Carne', 'g', 1, 250, 17.0, 0.0, 20.0, 0),
('Macinato di maiale', ARRAY['carne trita di maiale'], 'Carne', 'g', 1, 275, 18.0, 0.0, 22.0, 0),
('Maiale', ARRAY['pork','lonza'], 'Carne', 'g', 1, 210, 21.0, 0.0, 13.0, 0),
('Prosciutto cotto', ARRAY['prosciutto'], 'Carne', 'g', 1, 145, 20.0, 1.0, 7.0, 0),
('Salame', ARRAY['salsiccia','salame italiano'], 'Carne', 'g', 1, 420, 25.0, 3.0, 34.0, 0),
('Bacon', ARRAY['pancetta'], 'Carne', 'g', 1, 400, 25.0, 1.0, 33.0, 0),

-- Pesce
('Salmone', ARRAY['salmon'], 'Pesce', 'g', 1, 208, 20.0, 0.0, 13.0, 0),
('Tonno', ARRAY['tuna'], 'Pesce', 'g', 1, 116, 25.0, 0.0, 1.0, 0),
('Merluzzo', ARRAY['merluzzo','nasello'], 'Pesce', 'g', 1, 82, 18.0, 0.0, 0.7, 0),
('Gamberi', ARRAY['gambero','prawn'], 'Pesce', 'g', 1, 99, 24.0, 0.2, 0.3, 0),
('Sardine', ARRAY['sarda'], 'Pesce', 'g', 1, 145, 20.0, 0.0, 6.0, 0),
('Pesce bianco', ARRAY['orata','branzino','trota'], 'Pesce', 'g', 1, 90, 19.0, 0.0, 1.5, 0),

-- Cereali, pasta e pane
('Pane bianco', ARRAY['pane','pane comune'], 'Cereali e pane', 'g', 1, 265, 9.0, 49.0, 3.2, 2.7),
('Pane integrale', ARRAY['pane brown','integrale'], 'Cereali e pane', 'g', 1, 247, 13.0, 41.0, 3.4, 7.0),
('Pasta di semola cruda', ARRAY['pasta','spaghetti','penne'], 'Cereali e pane', 'g', 1, 350, 13.0, 71.0, 1.5, 3.2),
('Pasta fresca', ARRAY['tagliatelle','fresca'], 'Cereali e pane', 'g', 1, 300, 11.0, 60.0, 2.0, 2.0),
('Riso', ARRAY['riso crudo'], 'Cereali e pane', 'g', 1, 350, 7.0, 78.0, 1.0, 1.3),
('Riso basmati', ARRAY['basmati'], 'Cereali e pane', 'g', 1, 350, 7.0, 78.0, 1.0, 1.0),
('Farina tipo 0', ARRAY['farina','tipo 0'], 'Cereali e pane', 'g', 1, 340, 11.0, 70.0, 1.5, 2.7),
('Fiocchi d avena', ARRAY['avena','oatmeal'], 'Cereali e pane', 'g', 1, 380, 13.0, 60.0, 7.0, 10.0),
('Couscous', ARRAY['cous cous'], 'Cereali e pane', 'g', 1, 360, 12.0, 72.0, 1.0, 2.7),
('Grano duro', ARRAY['grano'], 'Cereali e pane', 'g', 1, 350, 13.0, 70, 2.5, 10.0),

-- Legumi
('Lenticchie secche', ARRAY['lenticchie'], 'Legumi', 'g', 1, 350, 25.0, 60.0, 1.0, 10.0),
('Fagioli secchi', ARRAY['fagioli'], 'Legumi', 'g', 1, 340, 21.0, 60.0, 1.5, 16.0),
('Ceci secchi', ARRAY['ceci'], 'Legumi', 'g', 1, 364, 19.0, 61.0, 6.0, 17.0),
('Piselli secchi', ARRAY['piselli'], 'Legumi', 'g', 1, 350, 24.0, 60.0, 1.0, 13.0),

-- Verdura
('Pomodori', ARRAY['pomodoro','pomi'], 'Verdura', 'g', 1, 18, 0.9, 3.9, 0.2, 1.2),
('Cipolle', ARRAY['cipolla'], 'Verdura', 'g', 1, 40, 1.1, 9.3, 0.1, 1.7),
('Zucchine', ARRAY['zucchina'], 'Verdura', 'g', 1, 17, 1.2, 3.1, 0.3, 1.0),
('Carote', ARRAY['carota'], 'Verdura', 'g', 1, 41, 0.9, 9.6, 0.2, 2.8),
('Patate', ARRAY['patata'], 'Verdura', 'g', 1, 77, 2.0, 17.0, 0.1, 2.2),
('Patate fritte', ARRAY['chips','fritte'], 'Verdura', 'g', 1, 536, 6.0, 52.0, 33.0, 4.5),
('Insalata', ARRAY['lattuga','insalata verde'], 'Verdura', 'g', 1, 15, 1.4, 2.9, 0.2, 1.3),
('Broccoli', ARRAY['broccolo'], 'Verdura', 'g', 1, 34, 2.8, 7.0, 0.4, 2.6),
('Spinaci', ARRAY:'spinacio', 'Verdura', 'g', 1, 23, 2.9, 3.6, 0.4, 2.2),
('Funghi', ARRAY['fungo','champignon'], 'Verdura', 'g', 1, 22, 3.1, 3.3, 0.3, 1.0),
('Melanzane', ARRAY['melanzana'], 'Verdura', 'g', 1, 25, 1.0, 6.0, 0.3, 3.0),
('Peperoni', ARRAY['peperone','pepper'], 'Verdura', 'g', 1, 31, 1.0, 6.0, 0.3, 2.1),
('Asparagi', ARRAY:'asparago', 'Verdura', 'g', 1, 20, 2.2, 3.9, 0.1, 2.1),
('Sedano', ARRAY['sedano'], 'Verdura', 'g', 1, 16, 0.7, 3.0, 0.2, 1.6),
('Cavolfiore', ARRAY['cavolfiore','cavolo'], 'Verdura', 'g', 1, 25, 1.9, 5.0, 0.3, 2.0),

-- Frutta
('Mele', ARRAY['mela'], 'Frutta', 'g', 1, 52, 0.3, 14.0, 0.2, 2.4),
('Banane', ARRAY['banana'], 'Frutta', 'g', 1, 89, 1.1, 23.0, 0.3, 2.6),
('Arance', ARRAY['arancia'], 'Frutta', 'g', 1, 47, 0.9, 12.0, 0.1, 2.4),
('Limoni', ARRAY['limone'], 'Frutta', 'g', 1, 29, 1.1, 9.0, 0.3, 2.8),
('Fragole', ARRAY:'fragola', 'Frutta', 'g', 1, 32, 0.7, 7.7, 0.3, 2.0),
('Uva', ARRAY:'uva', 'Frutta', 'g', 1, 69, 0.7, 18.0, 0.2, 0.9),
('Pere', ARRAY['pera'], 'Frutta', 'g', 1, 57, 0.4, 15.0, 0.1, 3.1),
('Pesche', ARRAY['pesca'], 'Frutta', 'g', 1, 42, 0.9, 10.0, 0.3, 1.5),
('Kiwi', ARRAY['kiwi'], 'Frutta', 'g', 1, 61, 1.1, 15.0, 0.5, 3.0),
('Ananas', ARRAY['ananas','pineapple'], 'Frutta', 'g', 1, 50, 0.5, 13.0, 0.1, 1.4),
('Avocado', ARRAY['avocado'], 'Frutta', 'g', 1, 160, 2.0, 9.0, 15.0, 6.7),
('Mandarini', ARRAY['mandarino','clementine'], 'Frutta', 'g', 1, 53, 0.8, 13.0, 0.2, 1.8),
('Melone', ARRAY:'melone', 'Frutta', 'g', 1, 34, 0.8, 8.0, 0.2, 0.8),

-- Dolci e zuccheri
('Zucchero', ARRAY['zucchero bianco','saccosio'], 'Dolci e zuccheri', 'g', 1, 400, 0.0, 100.0, 0.0, 0),
('Miele', ARRAY['miele naturale'], 'Dolci e zuccheri', 'g', 1, 304, 0.3, 82.0, 0.0, 0.2),
('Cioccolato al latte', ARRAY['cioccolato','lattina'], 'Dolci e zuccheri', 'g', 1, 535, 7.7, 59.0, 29.7, 3.4),
('Cioccolato fondente 70%', ARRAY['fondente','cioccolato nero'], 'Dolci e zuccheri', 'g', 1, 598, 8.0, 45.0, 43.0, 11.0),
('Biscotti secchi', ARRAY['biscotto','cookie'], 'Dolci e zuccheri', 'g', 1, 420, 7.0, 70.0, 14.0, 2.7),
('Torta generica', ARRAY['torta','dolce'], 'Dolci e zuccheri', 'g', 1, 350, 5.0, 48.0, 16.0, 1.5),
('Gelato', ARRAY['gelato','vaniglia'], 'Dolci e zuccheri', 'g', 1, 207, 3.5, 24.0, 11.0, 0.7),
('Caffè espresso', ARRAY['caffe','espresso'], 'Dolci e zuccheri', 'ml', 1, 2, 0.1, 0.3, 0.0, 0),
('Tè', ARRAY['te','the'], 'Dolci e zuccheri', 'ml', 1, 1, 0.0, 0.2, 0.0, 0),

-- Condimenti e oli
('Olio extravergine di oliva', ARRAY['olio','evo','extravergine'], 'Condimenti e oli', 'ml', 1, 884, 0.0, 0.0, 100.0, 0),
('Olio di semi', ARRAY['olio di mais','girasole','semi'], 'Condimenti e oli', 'ml', 1, 884, 0.0, 0.0, 100.0, 0),
('Burro di arachidi', ARRAY['arachidi','burro di arachide'], 'Condimenti e oli', 'g', 1, 588, 25.0, 20.0, 50.0, 6.0),
('Maionese', ARRAY['maionese'], 'Condimenti e oli', 'g', 1, 680, 1.0, 1.0, 75.0, 0),
('Ketchup', ARRAY['ketchup'], 'Condimenti e oli', 'g', 1, 100, 1.2, 25.0, 0.1, 0.3),
('Sale', ARRAY['sale','sale fino'], 'Condimenti e oli', 'g', 1, 0, 0.0, 0.0, 0.0, 0),
('Aceto', ARRAY['aceto di vino'], 'Condimenti e oli', 'ml', 1, 20, 0.0, 1.0, 0.0, 0),

-- Bevande
('Acqua', ARRAY['acqua minerale'], 'Bevande', 'ml', 1, 0, 0.0, 0.0, 0.0, 0),
('Bibita cola', ARRAY['cola','coca cola','fanta'], 'Bevande', 'ml', 1, 42, 0.0, 10.6, 0.0, 0),
('Birra', ARRAY['birra','lager'], 'Bevande', 'ml', 1, 43, 0.5, 3.6, 0.0, 0),
('Vino rosso', ARRAY['vino','rosso'], 'Bevande', 'ml', 1, 74, 0.1, 2.6, 0.0, 0),
('Succo d arancia', ARRAY['succo','arancia succo'], 'Bevande', 'ml', 1, 45, 0.7, 10.4, 0.2, 0.2),
('Acqua tonica', ARRAY['tonica'], 'Bevande', 'ml', 1, 34, 0.0, 8.4, 0.0, 0)

ON CONFLICT (name) DO UPDATE SET
  aliases         = EXCLUDED.aliases,
  category        = EXCLUDED.category,
  unit_default    = EXCLUDED.unit_default,
  grams_per_unit  = EXCLUDED.grams_per_unit,
  kcal_100g       = EXCLUDED.kcal_100g,
  protein_100g    = EXCLUDED.protein_100g,
  carbs_100g      = EXCLUDED.carbs_100g,
  fat_100g        = EXCLUDED.fat_100g,
  fiber_100g      = EXCLUDED.fiber_100g;