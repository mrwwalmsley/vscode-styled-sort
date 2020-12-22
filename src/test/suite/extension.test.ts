import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as extension from '../../extension';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Start all tests.');

  const trim = (code: string) => {
    return code.trim().trim().replace(/\t/g, '  ').replace(/^\s+$/m, '');
  };

  const sortTest = (input: string, output: string) => {
    const actual = trim(extension.sortJs(input));
    const expected = trim(output);
    assert.strictEqual(actual, expected);
  };

  test('Empty file', () => {
    sortTest('', '');
  });

  test('Single line JS file', () => {
    sortTest('const x = 5', 'const x = 5');
  });

  test('Two rule swap', () => {
    sortTest(
      `
const Icon = css\`
	display: flex;
	transition: all 0.2s;
	color: red;
\`;
    		`,
      `
const Icon = css\`
	color: red;
	display: flex;
	transition: all 0.2s;
\`;
    		`,
    );
  });

  test('Two rules with theme expression', () => {
    sortTest(
      `
const Icon = css\`
	display: flex;
	transition: all 0.2s;
	color: \${p => p.theme.text};
\`;
    		`,
      `
const Icon = css\`
	color: \${p => p.theme.text};
	display: flex;
	transition: all 0.2s;
\`;
    		`,
    );
  });

  test('Nested rules', () => {
    sortTest(
      `
const Icon = css\`
	display: flex;

	.test {
		font-size: 10px;
		color: blue;
	}
\`;
  		`,
      `
const Icon = css\`
	display: flex;

	.test {
		color: blue;
		font-size: 10px;
	}
\`;
  		`,
    );
  });

  test('Rules with calc', () => {
    sortTest(
      `
const Icon = css\`
height: \${audioButtonSize};
width: \${audioButtonSize};
border-radius: calc(\${audioButtonSize} / 2);
\`;
    		`,
      `
const Icon = css\`
	border-radius: calc(\${audioButtonSize} / 2);
	height: \${audioButtonSize};
	width: \${audioButtonSize};
\`;
    		`,
    );
  });

  test('Rules with calc', () => {
    sortTest(
      `
const Icon = css\`
	.test {
		color: red;
	}
\`;
  		`,
      `
const Icon = css\`
	.test {
		color: red;
	}
\`;
  		`,
    );
  });

  test('Two && rules', () => {
    sortTest(
      `
const Icon = css\`
&& {
	font-size: 20px;
	color: red;
}

&& .test {
	font-size: 10px;
	color: blue;
}
\`;
	`,
      `
const Icon = css\`
	&& {
		color: red;
		font-size: 20px;
	}

	&& .test {
		color: blue;
		font-size: 10px;
	}
\`;
	`,
    );
  });
});
