import path from 'path';
import * as out from '../lib/output';
import { listPackFiles, packDirectory } from '../lib/pack';

export default async function(dir: string | undefined, { output, list, all }: { output?: string; list?: boolean; all?: boolean }) {
    const rootDir = path.resolve(dir || process.cwd());
    try {
        if (list) {
            const { files, usedGitIgnore } = listPackFiles(rootDir, all);
            return out.success({ dir: rootDir, fileCount: files.length, usedGitIgnore, files }, files.join('\n'));
        }
        const zipPath = output || path.join(process.cwd(), `${path.basename(rootDir) || 'project'}.zip`);
        const result = await packDirectory(rootDir, zipPath, all);
        return out.success({ ...result }, `Packed ${result.fileCount} file(s) into ${result.zipPath} (${(result.sizeBytes / 1024).toFixed(0)} KB).`);
    }
    catch (e: any) {
        return out.fail(`Failed to pack: ${out.errorMessage(e)}`);
    }
}
