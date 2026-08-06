// Fix undici/node 20 fetch global conflict in Jest
delete global.fetch;
delete global.Headers;
delete global.Request;
delete global.Response;
delete global.CacheStorage;
delete global.caches;

