/**
 * 
 */
'use strict';

function _splitOnFirst(string, separator) {
    if (!(typeof string === 'string' && typeof separator === 'string')) {
        throw new TypeError('Expected the arguments to be of type `string`');
    }

    if (separator === '') {
        return [];
    }

    const separatorIndex = string.indexOf(separator);

    if (separatorIndex === -1) {
        return [];
    }

    return [
        string.slice(0, separatorIndex),
        string.slice(separatorIndex + separator.length)
    ];
}

function decode(value, options) {
    if (options.decode) return decodeuricomponent(value);
    return value;
}

function encode(value, options) {
    if (options.encode) return encodeuricomponent(value)
    return value
}

function removeHash(ipt) {
    const hashStart = ipt.indexOf("#")
    hashStart !== -1 && (ipt = ipt.slice(0, hashStart))
    return ipt
}

function getHash(url) {
	let hash = '';
	const hashStart = url.indexOf('#');
	if (hashStart !== -1) {
		hash = url.slice(hashStart);
	}

	return hash;
}

function extractQueryString(ipt) {
    ipt = removeHash(ipt)
    const queryStart = ipt.indexOf("?")
    if (queryStart === -1) return ''
    return ipt.slice(queryStart + 1)
}

function parseValue(value) {
    if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) {
        value = Number(value);
    } else if (value !== null && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
        value = value.toLowerCase() === 'true';
    }
    return value;
}

function stringifyForArrayFormat(params) {
    switch (params.arrayFormat) {
        case 'comma':
            return key => (result, value) => {
                if (value === null || value === undefined || value.length === 0) return result
                if (result.length === 0) return [`${encode(key, options)}=${encode(value, options)}`]
                return [[result, encode(value, options)].join(',')];
            }
        default:
            return key => (result, value) => {
                if (
                    value === undefined ||
                    (options.skipNull && value === null) ||
                    (options.skipEmptyString && value === '')
                ) {
                    return result;
                }
                if (value === null) return [...result, encode(key, options)]
                return [...result, `${encode(key, options)}=${encode(value, options)}`]
            }
    }
}

function parserForArrayFormat(options) {
    switch (options.arrayFormat) {
        case 'comma':
            return (key, value, accumulator) => {
                const isArray = typeof value === 'string' && value.split('').indexOf(',') > -1;
                const newValue = isArray ? value.split(",").map(item => decode(item, options)) : value === null ? value : decode(value, options);
                accumulator[key] = newValue;
            };

        default:
            return (key, value, accumulator) => {
                if (accumulator[key] === undefined) {
                    accumulator[key] = value;
                    return;
                }
                accumulator[key] = [].concat(accumulator[key], value);
            };
    }
}

function parse(ipt, options) {
    options = Object.assign({
        decode: true,
        arrayFormat: 'none'
    }, options)

    const ret = Object.create(null);
    if (typeof ipt !== 'string') return ret;

    const formatter = parserForArrayFormat(options);
    ipt = ipt.trim().replace(/^[?#&]/, '');
    if (!ipt) return ret

    for (const param of ipt.split("&")) {
        let [key, value] = _splitOnFirst(options.decode ? param.replace(/\+/g, ' ') : param, '=');
        value = value === undefined ? null : ['comma'].includes(options.arrayFormat) ? value : decode(value, options);
        formatter(decode(key, options), value, ret);
    }

    for (const iterator of Object.keys(ret)) {
        const value = ret[iterator]
        if (typeof value === 'object' && value !== null) {
            for (const k of Object.keys(value)) {
                value[k] = parseValue(value[k]);
            }
        } else {
            ret[key] = parseValue(value);
        }
    }

    return ret;
}

function stringify(object, options) {
    if (typeof object !== 'object' && object === null) return ''
    options = Object.assign({
        decode: true,
        arrayFormat: 'none',
        skipNull: true,
        skipEmptyString: true
    }, options)

    const formatter = stringifyForArrayFormat(options)

    const shouldFilter = key => (options.skipNull && (object[key] === null || object[key] === undefined)) || options.skipEmptyString && object[key] === ''

    const objectCopy = {};

    for (const key of Object.keys(object)) {
        if (!shouldFilter(key)) {
            objectCopy[key] = object[key];
        }
    }

    return Object.keys(objectCopy).map(key => {
        const value = object[key];

        if (value === undefined) {
            return '';
        }

        if (value === null) {
            return encode(key, options);
        }

        if (Array.isArray(value)) {
            return value.reduce(formatter(key), []).join("&")
        }
        return encode(key, options) + '=' + encode(value, options);
    }).filter(x => x.length > 0).join('&');
}

exports.parse = (input, options) => {
    return parse(extractQueryString(input),options)
}

exports.stringifyUrl = (input, options) => {
    const url = removeHash(input.url).split('?')[0] || '';
	const queryFromUrl = extractQueryString(input.url);
	const parsedQueryFromUrl = parse(queryFromUrl);
	const hash = getHash(input.url);
	const query = Object.assign(parsedQueryFromUrl, input.query);
	let queryString = stringify(query, options);
	if (queryString) {
		queryString = `?${queryString}`;
	}

	return `${url}${queryString}${hash}`;
} 
