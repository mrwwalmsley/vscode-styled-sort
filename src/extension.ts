import * as vscode from 'vscode';

/**
 * TODO:
 * Handle comments in CSS
 * Don't split multiline
 */

const regularExpressions = [
  /^[$]{(.*)}/,
  /^[(a-z)].*/,
  /^-/,
  /^\&:[(a-z)]/,
  /^[@media].*[?{]/,
];

function stringToArray(string: string) {
  const rules: string[] = [];

  let rule = string[0] || '';
  let blockLevel = 0;
  for (let index = 0; index < string.length; index++) {
    const nextChar = string[index + 1];
    let char = string[index];
    rule += char;

    //Skip to the end of the expression
    if (char === '$' && nextChar === '{') {
      blockLevel++;
      rule += nextChar;
      index++;
    } else if (char === '{') {
      blockLevel++;
    } else if (char === '}') {
      blockLevel--;
    } else if (blockLevel === 0 && char === ';') {
      rules.push(rule.trim());
      rule = '';
    }
  }

  return rules;
}

function sortRules(array: string[]) {
  const sortedArray = array
    .filter((text) => text !== '')
    .sort((a, b) => {
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

function addNewLineBetweenGroups(array: string[], numberOfTabs = 1) {
  let result = '';

  array.map((rule, index) => {
    // 👍 We want line breaks between template literals and other groups
    // If there are only two rules in the group in you don't want a space between them change comparison "index > 0" to "index > 1"
    // TODO make this a configuration options
    if (
      !rule.match(/^[$]{.*}/g) &&
      index > 0 &&
      array[index - 1].match(/^[$]{.*}/g)
    ) {
      result += '\n';
    }

    // 👍 We want line breaks between a vendor prefix and any previous rules or selectors
    if (
      array.length > 0 &&
      rule.match(/-webkit-|-moz-|-ms-|-o-/g) &&
      !array[index - 1].match(/-webkit-|-moz-|-ms-|-o-/g)
    ) {
      result += '\n';
    }

    result += `${'\t'.repeat(numberOfTabs)}${rule}\n`;
  });

  return result;
}

function isSupportedLanguage(language: string) {
  switch (language) {
    case 'javascript':
    case 'javascriptreact':
    case 'typescript':
    case 'typescriptreact':
      return true;
    default:
      return false;
  }
}

function handleNesting(lines: string[]) {
  let nestedSelector = '';
  let nestedSelectorString = '';
  let nestedSelectorExists = false;
  const mutableRules = lines.slice(0);

  // look for nested rules
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // nested selector exists when line matches regex
    if (line.match(/.*{$/)) {
      nestedSelectorExists = true;

      // Save the selector
      nestedSelector = line;

      // Remove the line from mutableRules
      mutableRules[i] = '';

      // Continue to next iteration
      continue;
    }

    // all subsequent lines are appended to subquery string
    if (nestedSelectorExists) {
      // Remove the line from mutableRules
      mutableRules[i] = '';

      if (line !== '}') {
        // TODO make this recursive
        nestedSelectorString += line;
        continue;
      }

      // We have reached the end of the nested selector
      nestedSelectorExists = false;

      // now insert line breaks so that we can safely split on \n like we did previously
      const nestedSelectorRulesArray = stringToArray(nestedSelectorString);

      // sort inner rules alphabetically
      const sortedNestedSelectorRules = sortRules(nestedSelectorRulesArray);

      // Add line break between groups
      const result = addNewLineBetweenGroups(sortedNestedSelectorRules, 2);

      mutableRules.push(`${nestedSelector}\n${result}\t}`);

      // Reset the string for the next cycle
      nestedSelectorString = '';
    }
  }

  return mutableRules;
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

    const matchStyledComponentWrapper = /(styled\..+|css|styled\(.+\))`([^`]+)`/g;
    const { document } = activeTextEditor;
    const result = document
      .getText()
      .replace(
        matchStyledComponentWrapper,
        (_: string, wrapper: string, rulesString: string) => {
          // new array from split on \n
          const rulesArray = stringToArray(rulesString);

          // handle nesting (recursivley)
          const nestedRules = handleNesting(rulesArray);

          // sort styled rules (opinionated ordering defined by regularExpressions dict)
          const sortedRules = sortRules(nestedRules);

          // Add line break between groups (opinionated)
          const breakRules = addNewLineBetweenGroups(sortedRules);
          console.log(breakRules);

          const result = breakRules.replace(
            /(?:\s)(&:|@|\.).*[?{]/g,
            (match) => `\n\t${match}`,
          );

          return `${wrapper}\`\n${result}\``;
        },
      );

    const firstLine = document.lineAt(0);
    const lastLine = document.lineAt(document.lineCount - 1);
    const range = new vscode.Range(firstLine.range.start, lastLine.range.end);
    const edits = new vscode.WorkspaceEdit();
    edits.replace(document.uri, range, result);
    return vscode.workspace.applyEdit(edits);
  });
}
