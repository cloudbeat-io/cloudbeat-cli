import reporters from '../reporters';

export function getReporterInstance(format, opts) {
    if (!format) {
        throw new Error('Invalid argument, "format" must be specified');
    }
    if (reporters[format]) {
        return new reporters[format](opts);
    }
    throw new Error(`Reporter of this format does not exist: ${format}`);
}

export function finishCLI(failOnErrors = true, result) {
    let code = 1;

    if(
        result && 
        result.result &&
        typeof result.result.isSuccess !== 'undefined'
    ){
        code = result.result.isSuccess ? 0 : 1;
    }
    
    
    if(failOnErrors === 'false'){
        failOnErrors = false;
    } else {
        failOnErrors = true;
    }

    if(failOnErrors){
        // do nothing, all ok
    } else {
        if(code === 0){
            code = 1;
        } else if(code === 1){
            code = 0;
        }
    }

    process.exit(code);
}

export default {
    getReporterInstance,
    finishCLI
};