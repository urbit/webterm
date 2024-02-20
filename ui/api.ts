import Urbit from '@urbit/http-api';
const api = Urbit.setupChannel({ url: '', verbose: true });
window.api = api;

api.on('subscription', (e) => console.log('subscription', e));
api.on('fact', (e) => console.log('msg', e));
// api.verbose = true;
// @ts-ignore TODO window typings


export default api;
