export default {
    '/results/api/results/run': {
        match: new RegExp('/results/api/results/run/.*'),
        status: 200,
        responseText: {
            data: 'success'
        }
    },
};