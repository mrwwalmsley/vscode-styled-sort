import { start } from 'repl';
import * as vscode from 'vscode';

let indentation = '\t';

const regularExpressions = [
  /^\${/,
  /^[a-z]/,
  /^-/,
  /^(&+\s*[{])/,
  /^&:[(a-z)]/,
  /^(&+ +)?[\.#>a-z][^{:;]* {/,
  /^@media/,
];

function stringToArray(string: string, parentNestingLevel: number) {
  const rules: string[] = [];

  type Block = {
    name: 'nested' | 'expression';
    index: number;
  };

  const blocks: Block[] = [];
  let startIndex = 0;

  for (let index = 0; index < string.length; index++) {
    const nextChar = string[index + 1];
    const char = string[index];

    const addRule = (rule: string) => {
      rules.push(rule);
      startIndex = index + 1;
    };

    if (char === '/' && nextChar === '*') {
      //Skip to the end of the comment
      do {
        index++;
      } while (
        index < string.length &&
        string[index] !== '*' &&
        string[index + 1] !== '/'
      );
    } else if (char === '$' && nextChar === '{') {
      index++;
      blocks.push({ name: 'expression', index: index + 1 });
    } else if (char === '{') {
      blocks.push({ name: 'nested', index: index + 1 });
    } else if (char === '}') {
      const nestingLevel = parentNestingLevel + blocks.length;
      const block = blocks.pop();
      if (blocks.length === 0 && block?.name === 'nested') {
        const nestedRules = string.substring(block.index, index - 1);
        const sortedRules = sortCss(nestedRules, nestingLevel);
        const suffix = `${indentation.repeat(nestingLevel)}}`;

        const nestedRule =
          string.substring(startIndex, block.index) +
          '\n' +
          sortedRules +
          suffix;
        addRule(nestedRule);
      }
    } else if (blocks.length === 0 && char === ';') {
      addRule(string.substring(startIndex, index + 1));
    }
  }

  return rules;
}

const matchComments = /\/\*.*?\*\//g;

function sortRules(array: string[]) {
  const sortedArray = array
    .map((text) => text.trim())
    .filter((text) => text !== '')
    .sort((aWithComments, bWithComments) => {
      const a = aWithComments.replace(matchComments, '').trim();
      const b = bWithComments.replace(matchComments, '').trim();

      for (let i = 0; i < regularExpressions.length; i++) {
        const re = regularExpressions[i];
        if (a.match(re)) {
          return compare(a, b, i);
        }
      }

      return 1;
    });

  return sortedArray;
}

function compare(a: string, b: string, aIndex: number) {
  for (let bIndex = 0; bIndex < regularExpressions.length; bIndex++) {
    const re = regularExpressions[bIndex];
    if (b.match(re)) {
      if (bIndex === aIndex) {
        if (a < b) {
          return -1;
        }
        if (a > b) {
          return 1;
        }
        return 0;
      }

      return aIndex - bIndex;
    }
  }

  return -1;
}

function addNewLineBetweenGroups(array: string[], nestingLevel = 1) {
  let result = '';

  const hasVendorPrefix = (rule: string) =>
    /-webkit-|-moz-|-ms-|-o-/.test(rule);

  const isExpression = (rule: string) => /^[$]{.*}/.test(rule);

  const isBlock = (rule: string) => /^(>|&|@|\.|#).*[?{,]/.test(rule);

  array.map((rule, index) => {
    if (index > 0) {
      const prevRule = array[index - 1];

      const isEndOfExpressionGroup =
        !isExpression(rule) && isExpression(prevRule);
      const isStartOfVendorPrefixGroup =
        array.length > 0 && hasVendorPrefix(rule) && !hasVendorPrefix(prevRule);

      if (
        isBlock(rule) ||
        isEndOfExpressionGroup ||
        isStartOfVendorPrefixGroup
      ) {
        result += `${indentation.repeat(nestingLevel)}\n`;
      }
    }

    result += `${indentation.repeat(nestingLevel)}${rule}\n`;
  });

  return result;
}

function isSupportedLanguage(language: string) {
  return [
    'javascript',
    'javascriptreact',
    'typescript',
    'typescriptreact',
  ].includes(language);
}

function sortCss(code: string, nestingLevel: number): string {
  // new array from split on \n
  const rulesArray = stringToArray(code, nestingLevel);

  // sort styled rules (opinionated ordering defined by regularExpressions dict)
  const sortedRules = sortRules(rulesArray);

  // Add line break between groups (opinionated)
  const breakRules = addNewLineBetweenGroups(sortedRules, nestingLevel + 1);

  return breakRules;
}

export function sortJs(code: string): string {
  const matchStyledComponentWrapper = /(styled\..+|css|styled\(.+\))`([^`]+)`/g;
  return code.replace(
    matchStyledComponentWrapper,
    (_: string, wrapper: string, rulesString: string) => {
      const result = sortCss(rulesString, 0);
      return `${wrapper}\`\n${result}\``;
    },
  );
}

export function activate(): void {
  vscode.commands.registerCommand('extension.styled-components-sort', () => {
    const { activeTextEditor } = vscode.window;

    if (
      !activeTextEditor ||
      !isSupportedLanguage(activeTextEditor.document.languageId)
    ) {
      return;
    }

    const { document } = activeTextEditor;
    const text = document.getText();

    //Check for tabs, 2 spaces or 4 spaces
    if (text.includes('\t')) {
      indentation = '\t';
    } else {
      indentation = /^  \S/m.test(text) ? '  ' : '    ';
    }

    const result = sortJs(text);

    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const range = new vscode.Range(firstLine.range.start, lastLine.range.end);
    const edits = new vscode.WorkspaceEdit();
    edits.replace(document.uri, range, result);
    return vscode.workspace.applyEdit(edits);
  });
}
