import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';

const isObject = (value: unknown) => typeof value === 'object' && value !== null && !Array.isArray(value);

export const marshallItem = (item: Record<string, NativeAttributeValue>): Record<string, NativeAttributeValue> => {
	let newItem: Record<string, NativeAttributeValue> = {};

	newItem = Object.fromEntries(
		Object.entries(item).map(([key, value]) => {
			return [key, marshall(value)];
		}),
	);
	return newItem;
};

const marshallArray = (arr: NativeAttributeValue[]): NativeAttributeValue[] => {
	return arr.map((value) => marshall(value));
};

const marshall = (value: NativeAttributeValue): NativeAttributeValue => {
	if (value instanceof Date) {
		return value.toISOString();
	}
	if (Array.isArray(value)) {
		return marshallArray(value);
	}
	if (isObject(value)) {
		return marshallItem(value);
	}
	return value;
};

const isDateRegexp = new RegExp(
	'^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9]))T(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9]).[0-9]{3}Z$',
);

export const unmarshallItem = (item: Record<string, NativeAttributeValue>): Record<string, NativeAttributeValue> => {
	let newItem: Record<string, NativeAttributeValue> = {};

	newItem = Object.fromEntries(
		Object.entries(item).map(([key, value]) => {
			return [key, unmarshall(value)];
		}),
	);
	return newItem;
};

const unmarshallArray = (arr: NativeAttributeValue[]): NativeAttributeValue[] => {
	return arr.map((value) => unmarshall(value));
};

const unmarshall = (value: NativeAttributeValue): NativeAttributeValue => {
	if (isDateRegexp.test(value)) {
		const date = new Date(value);
		if (!isNaN(date.getTime())) {
			//check if date is valid
			return date;
		}
		return value;
	}
	if (Array.isArray(value)) {
		return unmarshallArray(value);
	}
	if (isObject(value)) {
		return unmarshallItem(value);
	}
	return value;
};
