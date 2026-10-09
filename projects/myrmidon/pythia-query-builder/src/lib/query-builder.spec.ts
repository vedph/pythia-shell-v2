import {
  QueryBuilder,
  QueryBuilderEntry,
  QueryBuilderTermDefArg,
  QUERY_DOC_ATTR_DEFS,
  QUERY_LOCATION_OP_DEFS,
  QUERY_OP_DEFS,
  QUERY_PAIR_OP_DEFS,
  QUERY_STRUCT_ATTR_DEFS,
  QUERY_TOK_ATTR_DEFS,
} from './query-builder';

const tokAttr = (v: string) => QUERY_TOK_ATTR_DEFS.find((d) => d.value === v)!;
const pairOp = (v: string) => QUERY_PAIR_OP_DEFS.find((d) => d.value === v)!;
const op = (v: string): QueryBuilderEntry => ({
  operator: QUERY_OP_DEFS.find((d) => d.value === v)!,
});
const pair = (value: string, attr = 'value', operator = '='): QueryBuilderEntry => ({
  pair: { attribute: tokAttr(attr), operator: pairOp(operator), value },
});
const locOp = (
  v: string,
  values: Record<string, string> = {},
): QueryBuilderEntry => {
  const def = QUERY_LOCATION_OP_DEFS.find((d) => d.value === v)!;
  return {
    operator: def,
    // as copied by the editor: all the defined args, with or without value
    opArgs: def.args!.map((a) => ({ ...a, value: values[a.id] })),
  };
};

describe('QueryBuilder', () => {
  let builder: QueryBuilder;
  let errors: string[];

  beforeEach(() => {
    builder = new QueryBuilder();
    builder.selectErrors().subscribe((e) => (errors = e));
  });

  const set = (...entries: QueryBuilderEntry[]) => builder.setEntries(entries);

  describe('definitions', () => {
    it('should have a group for each pair operator', () => {
      expect(QUERY_PAIR_OP_DEFS.every((d) => d.group)).toBe(true);
      expect(pairOp('<=').label).toBe('less-than or equal');
    });

    it('should identify location operators', () => {
      for (const d of QUERY_LOCATION_OP_DEFS) {
        expect(QueryBuilder.isLocOperator(d.value)).toBe(true);
      }
      expect(QueryBuilder.isLocOperator('AND')).toBe(false);
      expect(QueryBuilder.isLocOperator('NOT')).toBe(false);
      expect(QueryBuilder.isLocOperator(undefined)).toBe(false);
      expect(QueryBuilder.isLocOperator(null)).toBe(false);
    });
  });

  describe('build', () => {
    it('should build empty without entries', () => {
      expect(builder.build()).toBe('');
    });

    it('should build a token pair', () => {
      builder.addEntry(pair('a'));
      expect(builder.build()).toBe('[value="a"]');
    });

    it('should build a structure pair with $ prefix', () => {
      builder.addEntry({
        pair: {
          attribute: QUERY_STRUCT_ATTR_DEFS[0],
          operator: pairOp('='),
          value: 'snt',
        },
      });
      expect(builder.build()).toBe('[$name="snt"]');
    });

    it('should build fuzzy with treshold inside value', () => {
      const fuzzy = pairOp('%=');
      builder.addEntry({
        pair: {
          attribute: tokAttr('value'),
          operator: fuzzy,
          value: 'chommoda',
          opArgs: [{ ...fuzzy.args![0], value: '0.75' }],
        },
      });
      expect(builder.build()).toBe('[value%="chommoda:0.75"]');
    });

    it('should build fuzzy without treshold value', () => {
      const fuzzy = pairOp('%=');
      builder.addEntry({
        pair: {
          attribute: tokAttr('value'),
          operator: fuzzy,
          value: 'chommoda',
          opArgs: [{ ...fuzzy.args![0] }],
        },
      });
      expect(builder.build()).toBe('[value%="chommoda"]');
    });

    it('should build logical operators', () => {
      builder.addEntry(pair('a'));
      builder.addEntry(op('OR'));
      builder.addEntry(pair('b'));
      expect(builder.build()).toBe('[value="a"] OR [value="b"]');
      expect(errors).toEqual([]);
    });

    it('should build NEAR with all args', () => {
      set(pair('a'), locOp('NEAR', { n: '0', m: '1', s: 'sent' }), pair('b'));
      expect(builder.build()).toBe(
        '[value="a"] NEAR(n=0,m=1,s=sent) [value="b"]',
      );
    });

    it('should build NEAR with default n/m when not set', () => {
      set(pair('a'), locOp('NEAR'), pair('b'));
      expect(errors).toEqual([]);
      expect(builder.build()).toBe(
        '[value="a"] NEAR(n=0,m=2147483647) [value="b"]',
      );
    });

    it('should build NEAR with only max set', () => {
      set(pair('a'), locOp('NEAR', { m: '3' }), pair('b'));
      expect(errors).toEqual([]);
      expect(builder.build()).toBe('[value="a"] NEAR(n=0,m=3) [value="b"]');
    });

    it('should build NEAR with only min set', () => {
      set(pair('a'), locOp('NEAR', { n: '2' }), pair('b'));
      expect(errors).toEqual([]);
      expect(builder.build()).toBe(
        '[value="a"] NEAR(n=2,m=2147483647) [value="b"]',
      );
    });

    it('should build INSIDE with all args', () => {
      set(
        pair('a'),
        locOp('INSIDE', { ns: '0', ms: '1', ne: '2', me: '3', s: 'sent' }),
        pair('b'),
      );
      expect(builder.build()).toBe(
        '[value="a"] INSIDE(ns=0,ms=1,ne=2,me=3,s=sent) [value="b"]',
      );
    });

    it('should build INSIDE with defaults', () => {
      set(pair('a'), locOp('INSIDE', { ms: '5' }), pair('b'));
      expect(builder.build()).toBe(
        '[value="a"] INSIDE(ns=0,ms=5,ne=0,me=2147483647) [value="b"]',
      );
    });

    it('should build NOT location operators without s', () => {
      set(pair('a'), locOp('NOT NEAR', { n: '1', m: '2' }), pair('b'));
      expect(errors).toEqual([]);
      expect(builder.build()).toBe('[value="a"] NOT NEAR(n=1,m=2) [value="b"]');
    });

    it('should build a document query', () => {
      builder.forDocument(true);
      set(
        {
          pair: {
            attribute: QUERY_DOC_ATTR_DEFS[0],
            operator: pairOp('*='),
            value: 'Hom',
          },
        },
        op('AND NOT'),
        {
          pair: {
            attribute: QUERY_DOC_ATTR_DEFS[2],
            operator: pairOp('>'),
            value: '100',
          },
        },
      );
      expect(errors).toEqual([]);
      expect(builder.build()).toBe(
        '@[author*="Hom"] AND NOT [date_value>"100"];\n',
      );
    });

    it('should build corpus section', () => {
      expect(builder.buildCorpusSection()).toBe('');
      expect(builder.buildCorpusSection([])).toBe('');
      expect(
        builder.buildCorpusSection([
          { id: 'a', title: 'A', description: '' },
          { id: 'b', title: 'B', description: '' },
        ]),
      ).toBe('@@a b;\n');
    });
  });

  describe('validate', () => {
    it('should require entries for text', () => {
      builder.reset();
      expect(errors).toEqual(['Query is empty']);
    });

    it('should allow no entries for documents', () => {
      builder.forDocument(true);
      expect(errors).toEqual([]);
    });

    it('should require a single entry to be a pair', () => {
      set(op('AND'));
      expect(errors).toEqual(['#1: Expected pair']);
    });

    it('should require first entry to be pair or (', () => {
      set(op('OR'), pair('a'));
      expect(errors).toContain('#1: Expected pair or (');
    });

    it('should accept balanced brackets starting the query', () => {
      set(op('('), pair('a'), op('OR'), pair('b'), op(')'), op('AND'), pair('c'));
      expect(errors).toEqual([]);
      expect(builder.build()).toBe(
        '( [value="a"] OR [value="b"] ) AND [value="c"]',
      );
    });

    it('should accept nested brackets', () => {
      set(
        op('('),
        op('('),
        pair('a'),
        op('OR'),
        pair('b'),
        op(')'),
        op('AND'),
        pair('c'),
        op(')'),
      );
      expect(errors).toEqual([]);
    });

    it('should detect unbalanced brackets', () => {
      set(op('('), pair('a'));
      expect(errors).toContain('Unbalanced parentheses');
      set(pair('a'), op(')'));
      expect(errors).toContain('Unbalanced parentheses');
    });

    it('should detect closing bracket before opening one', () => {
      set(pair('a'), op(')'), op('AND'), op('('), pair('b'));
      expect(errors).toContain('Unbalanced parentheses');
    });

    it('should detect bracket at end', () => {
      set(pair('a'), op('AND'), op('('));
      expect(errors).toContain('#3: Opening bracket at end');
    });

    it('should detect ( after pair or )', () => {
      set(pair('a'), op('('), pair('b'), op(')'));
      expect(errors).toContain('#2: Unexpected entry type');
    });

    it('should detect ) after logical', () => {
      set(op('('), pair('a'), op('AND'), op(')'));
      expect(errors).toContain('#4: Unexpected entry type');
    });

    it('should detect logical at end or after logical', () => {
      set(pair('a'), op('AND'));
      expect(errors).toContain('#2: Logical operator at end');
      set(pair('a'), op('AND'), op('OR'), pair('b'));
      expect(errors).toContain('#3: Unexpected entry type');
    });

    it('should not allow AND NOT in text', () => {
      set(pair('a'), op('AND NOT'), pair('b'));
      expect(errors).toEqual(['#2: AND NOT is allowed only in document scope']);
    });

    it('should detect unconnected pairs', () => {
      set(pair('a'), pair('b'));
      expect(errors).toEqual(['#2: Pairs not connected by operator']);
      set(op('('), pair('a'), op(')'), pair('b'));
      expect(errors).toContain('#4: Pairs not connected by operator');
    });

    it('should require location operators between pairs', () => {
      set(pair('a'), locOp('NEAR'), op('('), pair('b'), op(')'));
      expect(errors).toContain('#2: Location operator must connect two pairs');
    });

    it('should not allow location operators in documents', () => {
      builder.forDocument(true);
      set(pair('a'), locOp('NEAR'), pair('b'));
      expect(errors).toContain(
        '#2: Location operator not allowed in document scope',
      );
    });

    it('should reject n > m', () => {
      set(pair('a'), locOp('BEFORE', { n: '5', m: '2' }), pair('b'));
      expect(errors).toEqual(['Invalid value in n/m argument(s).']);
    });

    it('should reject non-numeric n/m', () => {
      set(pair('a'), locOp('AFTER', { n: 'x' }), pair('b'));
      expect(errors).toEqual(['Invalid value in n/m argument(s).']);
    });

    it('should reject ns > ms and ne > me', () => {
      set(pair('a'), locOp('INSIDE', { ns: '5', ms: '2' }), pair('b'));
      expect(errors).toEqual(['Invalid value in ns/ms argument(s).']);
      set(pair('a'), locOp('INSIDE', { ne: '5', me: '2' }), pair('b'));
      expect(errors).toEqual(['Invalid value in ne/me argument(s).']);
    });

    it('should reject s with NOT operators only when set', () => {
      set(pair('a'), locOp('NOT INSIDE', { s: 'snt' }), pair('b'));
      expect(errors).toEqual(['Argument s cannot be used with NOT.']);
      set(pair('a'), locOp('NOT OVERLAPS', { s: 'snt' }), pair('b'));
      expect(errors).toEqual(['Argument s cannot be used with NOT.']);
      set(pair('a'), locOp('NOT INSIDE'), pair('b'));
      expect(errors).toEqual([]);
    });

    it('should reject values with double quotes', () => {
      set(pair('a"b'));
      expect(errors).toEqual(['#1: Value cannot contain double quotes']);
    });

    it('should supply missing location args', () => {
      const entry: QueryBuilderEntry = {
        operator: QUERY_LOCATION_OP_DEFS[0],
      };
      set(pair('a'), entry, pair('b'));
      const ids = (entry.opArgs as QueryBuilderTermDefArg[]).map((a) => a.id);
      expect(ids).toEqual(['n', 'm']);
    });
  });

  describe('editing', () => {
    it('should set entries and emit them', () => {
      let entries: QueryBuilderEntry[] = [];
      builder.selectEntries().subscribe((e) => (entries = e));
      const list = [pair('a')];
      set(...list);
      expect(builder.getEntries()).toEqual(list);
      expect(entries).toEqual(list);
    });

    it('should ignore setting the same entries', () => {
      const list = [pair('a')];
      builder.setEntries(list);
      let emitted = 0;
      builder.selectEntries().subscribe(() => emitted++);
      builder.setEntries(list);
      expect(emitted).toBe(1);
    });

    it('should connect appended pairs with AND', () => {
      builder.addEntry(pair('a'));
      builder.addEntry(pair('b'));
      expect(builder.build()).toBe('[value="a"] AND [value="b"]');
    });

    it('should connect a pair inserted before a pair with AND', () => {
      builder.addEntry(pair('b'));
      builder.addEntry(pair('a'), 0, true);
      expect(builder.build()).toBe('[value="a"] AND [value="b"]');
      expect(errors).toEqual([]);
    });

    it('should connect a pair inserted between pairs with AND', () => {
      set(pair('a'), op('OR'), pair('c'));
      // insert before OR: a ? OR c
      builder.addEntry(pair('b'), 1, true);
      expect(builder.build()).toBe(
        '[value="a"] AND [value="b"] OR [value="c"]',
      );
    });

    it('should insert non-pair entries as they are', () => {
      set(pair('a'), op('OR'), pair('b'));
      builder.addEntry(op('('), 0, true);
      expect(builder.build()).toBe('( [value="a"] OR [value="b"]');
    });

    it('should replace an entry', () => {
      set(pair('a'), op('OR'), pair('b'));
      builder.addEntry(op('AND'), 1);
      expect(builder.build()).toBe('[value="a"] AND [value="b"]');
      builder.addEntry(pair('c'), 2);
      expect(builder.build()).toBe('[value="a"] AND [value="c"]');
    });

    it('should delete an entry', () => {
      set(pair('a'), op('OR'), pair('b'));
      builder.deleteEntry(1);
      expect(builder.getEntries().length).toBe(2);
      expect(errors).toEqual(['#2: Pairs not connected by operator']);
    });

    it('should move entries up and down', () => {
      set(pair('a'), op('OR'), pair('b'));
      builder.moveEntryUp(2);
      expect(builder.build()).toBe('[value="a"] [value="b"] OR');
      builder.moveEntryDown(1);
      expect(builder.build()).toBe('[value="a"] OR [value="b"]');
      // out of range: no change
      builder.moveEntryUp(0);
      builder.moveEntryDown(2);
      expect(builder.build()).toBe('[value="a"] OR [value="b"]');
    });

    it('should reset entries', () => {
      set(pair('a'));
      builder.reset();
      expect(builder.getEntries()).toEqual([]);
    });
  });
});
