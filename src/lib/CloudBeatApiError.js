export default class CloudBeatApiError extends Error {
    constructor(msgOrError) {
        super(typeof msgOrError === 'string' ? msgOrError : undefined);
        this.name = this.constructor.name;

        if (msgOrError instanceof Error && msgOrError.response) {
            const response = msgOrError.response;
            if (response.status === 500) {
                this.message = 'Internal server error, please try again later.';
            }
            else if (response.status === 401) {
                this.message = 'Authentication failed, invalid API key.';
            }
            else if (response.status === 404) {
                this.message = 'A record or an endpoint does not exist.';
                this.path = response.request.path;
            }
            else if (response.status === 204) {
                this.message = 'A record or an endpoint does not have content.';
                if(response && response.request && response.request.path){
                    this.path = response.request.path;
                }
            }
            else if (response.status === 422){

                let message = '';

                if(response.data && response.data.errorMessage){
                    if(response.data.errorMessage){
                        message = response.data.errorMessage;
                    }
                    if(response.data.errors && Array.isArray(response.data.errors) && response.data.errors.length > 0){
                        message += ':';
                        response.data.errors.map((msg) => {
                            message += ' '+msg;
                        });
                    }
                } else {
                    message = 'Validation Failed';
                }

                this.message = message;
            }
            else {
                this.message = response.statusText;
            }
        }        
        Error.captureStackTrace(this, this.constructor);
    }
}