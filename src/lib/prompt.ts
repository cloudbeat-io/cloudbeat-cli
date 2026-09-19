import readline from 'readline';

export const isInteractive = () => !!process.stdin.isTTY;

export const ask = (question: string): Promise<string> => {
    // prompts go to stderr, so that stdout stays clean for --json output
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
};

// asks a question without echoing the typed answer
export const askSecret = (question: string): Promise<string> => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    let muted = false;
    // eslint-disable-next-line no-underscore-dangle
    (rl as any)._writeToOutput = (str: string) => {
        if (!muted) {
            process.stderr.write(str);
        }
    };
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            process.stderr.write('\n');
            resolve(answer.trim());
        });
        muted = true;
    });
};

export const readStdin = (): Promise<string> => {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (chunk: string) => data += chunk);
        process.stdin.on('end', () => resolve(data.trim()));
        process.stdin.on('error', reject);
    });
};
