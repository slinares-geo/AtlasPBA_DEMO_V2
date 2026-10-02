"""Parser regressions and audit of the downloaded official snapshot."""
import copy
import unittest
from import_jepba_2025 import DEFAULT_ROOT, SOURCE_ID, APP, integer, percentage, parse_page, validate_page, read, package, merge_into


class JuntaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.html = (DEFAULT_ROOT / 'raw/distrito_001.html').read_text(encoding='utf-8')
        cls.parsed = parse_page(cls.html, '001', 'distrito')
        cls.normalized = read(DEFAULT_ROOT / 'normalized/jepba_2025_normalized.json')

    def test_semantic_table_detection(self):
        decoy = '<table><tr><td>Irrelevant</td></tr></table>'
        self.assertEqual(parse_page(decoy+self.html+decoy, '001', 'distrito'), self.parsed)

    def test_numbers_and_missing(self):
        self.assertEqual(integer('12.345'), 12345)
        self.assertIsNone(integer('-'))
        self.assertIsNone(percentage('-'))
        self.assertEqual(percentage('58.21%'), 58.21)
        for bad in ['12.34', '12x', '-5']:
            with self.assertRaises(ValueError): integer(bad)
        with self.assertRaises(ValueError): percentage('101%')

    def test_invalid_identity(self):
        with self.assertRaises(ValueError): parse_page(self.html, '002', 'distrito')

    def test_invalid_votes_percentage_and_duplicates(self):
        for field in ['votos', 'porcentaje_oficial', 'duplicate']:
            parsed = copy.deepcopy(self.parsed)
            groups = parsed['categories'][parsed['categoria_provincial']]['groups']
            group = next(g for g in groups if g['votos'] is not None)
            if field == 'duplicate': groups.append(copy.deepcopy(group))
            else: group[field] += 1
            with self.assertRaises(ValueError): validate_page(parsed)

    def test_all_official_pages(self):
        for kind, ids in [('distrito', [f'{i:03}' for i in range(1,136)]), ('seccion', [str(i) for i in range(1,9)])]:
            for identifier in ids:
                with self.subTest(kind=kind, identifier=identifier):
                    html = (DEFAULT_ROOT / f'raw/{kind}_{identifier}.html').read_text(encoding='utf-8')
                    validate_page(parse_page(html, identifier, kind))

    def test_counts_reconciliation_and_idempotency(self):
        audit = self.normalized['validation']
        self.assertEqual((audit['districts'], audit['records'], audit['records_with_votes']), (135,4274,2935))
        self.assertEqual(audit['duplicate_natural_keys'], 0)
        for section in audit['section_reconciliation']:
            for key in ['diferencias_agrupaciones','diferencias_totales','diferencias_metadatos']:
                self.assertEqual(section[key], {})
        payload = read(APP / 'data/electoral_data.json')
        before = copy.deepcopy(payload)
        addition = package(self.normalized)
        merge_into(payload, addition)
        merge_into(payload, addition)
        self.assertEqual(payload, before)
        original = read(DEFAULT_ROOT / 'load_audit/electoral_data_before.json')
        self.assertEqual(payload['defaults'], original['defaults'])
        for source in original['sources']:
            self.assertIn(source, payload['sources'])
        for level in ['party','locality','circuit']:
            for key, rows in original[level]['elections'].items():
                self.assertEqual(payload[level]['elections'][key], rows)
        for row in payload['party']['elections'][SOURCE_ID].values():
            self.assertIsNone(row['votantes'])
            self.assertIsNone(row['participacion'])
            self.assertIsNone(row['nulo'])


if __name__ == '__main__':
    unittest.main()
