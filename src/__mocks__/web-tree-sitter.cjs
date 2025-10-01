// Mock implementation of web-tree-sitter for testing (CommonJS)

function createMockNode(type = 'module') {
  const node = {
    type,
    text: '',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    startIndex: 0,
    endIndex: 0,
    parent: null,
    children: [],
    namedChildren: [],
    childCount: 0,
    namedChildCount: 0,
    firstChild: null,
    firstNamedChild: null,
    lastChild: null,
    lastNamedChild: null,
    nextSibling: null,
    nextNamedSibling: null,
    previousSibling: null,
    previousNamedSibling: null,
    hasChanges: () => false,
    hasError: () => false,
    isNamed: () => true,
    isMissing: () => false,
    toString: () => type,
    child: () => null,
    namedChild: () => null,
    childForFieldName: () => null,
    childForFieldId: () => null,
    fieldNameForChild: () => null,
    childrenForFieldName: () => [],
    childrenForFieldId: () => [],
    firstChildForIndex: () => null,
    firstNamedChildForIndex: () => null,
    descendantForIndex: () => null,
    namedDescendantForIndex: () => null,
    descendantForPosition: () => null,
    namedDescendantForPosition: () => null,
    descendantsOfType: () => [],
    closest: () => null,
    walk: () => createMockCursor(),
  };

  return node;
}

function createMockCursor() {
  return {
    nodeType: 'module',
    nodeText: '',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    startIndex: 0,
    endIndex: 0,
    currentNode: () => createMockNode(),
    gotoFirstChild: () => false,
    gotoNextSibling: () => false,
    gotoParent: () => false,
  };
}

function createMockTree() {
  return {
    rootNode: createMockNode(),
    edit: () => {},
    walk: () => createMockCursor(),
    getChangedRanges: () => [],
    getIncludedRanges: () => [],
  };
}

function createMockLanguage(name = 'javascript') {
  return {
    name,
    fieldCount: 0,
    nodeTypeCount: 0,
    version: 13,
    fieldNameForId: () => null,
    fieldIdForName: () => null,
    idForNodeType: () => 0,
    nodeTypeForId: () => null,
    nodeTypeIsNamed: () => false,
    nodeTypeIsVisible: () => false,
    query: () => ({}),
  };
}

function MockParser() {
  this.language = null;
  this.parse = function (input, oldTree) { return createMockTree(); };
  this.parseTextBuffer = function (buffer, oldTree) { return createMockTree(); };
  this.parseTextBufferSync = function (buffer, oldTree) { return createMockTree(); };
  this.getLanguage = function () { return this.language; };
  this.setLanguage = function (language) { this.language = language; };
  this.getLogger = function () { return null; };
  this.setLogger = function () {};
  this.printDotGraphs = function () {};
  this.delete = function () {};
}

MockParser.init = function () { return Promise.resolve(); };
MockParser.Language = { load: function () { return Promise.resolve(createMockLanguage()); } };

module.exports = MockParser;
module.exports.Parser = MockParser;
module.exports.Language = { load: async function (path) {
  const languageName = path.includes('javascript') ? 'javascript' :
                        path.includes('typescript') ? 'typescript' :
                        path.includes('python') ? 'python' :
                        path.includes('rust') ? 'rust' :
                        path.includes('cpp') ? 'cpp' :
                        path.includes('c') ? 'c' :
                        'unknown';
  return createMockLanguage(languageName);
} };

module.exports.init = function () { return Promise.resolve(); };


