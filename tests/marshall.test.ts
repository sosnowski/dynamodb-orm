import { describe, it, expect } from 'vitest';
import { marshallItem, unmarshallItem } from 'src/marshall';

describe('Marshalling item', () => {
	it('Should not affect simple object with string and numbers', () => {
		const item = {
			age: 37,
			name: 'Damian',
			height: 194.5,
			isAwesome: true,
		};

		expect(marshallItem(item)).toEqual({
			age: 37,
			name: 'Damian',
			height: 194.5,
			isAwesome: true,
		});
	});

	it('Should not affect empty and falsy values', () => {
		const item = {
			isNull: null,
			isUndef: undefined,
			isZero: 0,
			isEmpty: '',
			isFalse: false,
		};

		expect(marshallItem(item)).toEqual({
			isNull: null,
			isUndef: undefined,
			isZero: 0,
			isEmpty: '',
			isFalse: false,
		});
	});

	it('Should handle nested array with primitive values', () => {
		const item = {
			name: 'Damian',
			likes: ['writting', 'code', 'after', 'hours', 42],
		};

		expect(marshallItem(item)).toEqual({
			name: 'Damian',
			likes: ['writting', 'code', 'after', 'hours', 42],
		});
	});

	it('Should handle nested object with primitive values', () => {
		const item = {
			name: 'Damian',
			bodyParts: {
				head: 1,
				arms: 2,
				legs: 2,
				spine: 1,
				what: 'am I doing actually?',
			},
		};

		expect(marshallItem(item)).toEqual({
			name: 'Damian',
			bodyParts: {
				head: 1,
				arms: 2,
				legs: 2,
				spine: 1,
				what: 'am I doing actually?',
			},
		});
	});

	it('Should handle array with nested objects and arrays', () => {
		const item = {
			name: 'Damian',
			children: [
				{
					name: 'Barbara',
					favColors: ['pink', 'blue'],
				},
				{
					name: 'Helena',
					favColors: ['red'],
				},
			],
		};

		expect(marshallItem(item)).toEqual({
			name: 'Damian',
			children: [
				{
					name: 'Barbara',
					favColors: ['pink', 'blue'],
				},
				{
					name: 'Helena',
					favColors: ['red'],
				},
			],
		});
	});

	it('Should handle objects with nested objects and arrays', () => {
		const item = {
			name: 'Damian',
			family: {
				children: ['Barbara', 'Helena'],
				wife: {
					name: 'Olga',
				},
			},
		};

		expect(marshallItem(item)).toEqual({
			name: 'Damian',
			family: {
				children: ['Barbara', 'Helena'],
				wife: {
					name: 'Olga',
				},
			},
		});
	});

	it('Should marshall Date object to ISO string', () => {
		const date = new Date(1985, 12, 29);
		const item = {
			name: 'Damian',
			birthday: date,
		};

		expect(marshallItem(item)).toEqual({
			name: 'Damian',
			birthday: date.toISOString(),
		});
	});

	it('Should marshall Date object to ISO string in nested properties', () => {
		const damianDate = new Date(1985, 12, 29);
		const barbaraDate = new Date(2018, 12, 23);
		const helenaDate = new Date(2021, 9, 1);
		const olgaDate = new Date(1986, 10, 29);
		const item = {
			name: 'Damian',
			birthday: damianDate,
			family: {
				children: [
					{
						name: 'Barbara',
						birthday: barbaraDate,
					},
					{
						name: 'Helena',
						birthday: helenaDate,
					},
				],
				wife: {
					name: 'Olga',
					birthday: olgaDate,
				},
			},
		};

		expect(marshallItem(item)).toEqual({
			name: 'Damian',
			birthday: damianDate.toISOString(),
			family: {
				children: [
					{
						name: 'Barbara',
						birthday: barbaraDate.toISOString(),
					},
					{
						name: 'Helena',
						birthday: helenaDate.toISOString(),
					},
				],
				wife: {
					name: 'Olga',
					birthday: olgaDate.toISOString(),
				},
			},
		});
	});
});

describe('Unmarshalling item', () => {
	it('Should not affect simple object with string and numbers', () => {
		const item = {
			age: 37,
			name: 'Damian',
			height: 194.5,
			isAwesome: true,
		};

		expect(unmarshallItem(item)).toEqual({
			age: 37,
			name: 'Damian',
			height: 194.5,
			isAwesome: true,
		});
	});

	it('Should not affect empty and falsy values', () => {
		const item = {
			isNull: null,
			isUndef: undefined,
			isZero: 0,
			isEmpty: '',
			isFalse: false,
		};

		expect(unmarshallItem(item)).toEqual({
			isNull: null,
			isUndef: undefined,
			isZero: 0,
			isEmpty: '',
			isFalse: false,
		});
	});

	it('Should handle nested array with primitive values', () => {
		const item = {
			name: 'Damian',
			likes: ['writting', 'code', 'after', 'hours', 42],
		};

		expect(unmarshallItem(item)).toEqual({
			name: 'Damian',
			likes: ['writting', 'code', 'after', 'hours', 42],
		});
	});

	it('Should handle nested object with primitive values', () => {
		const item = {
			name: 'Damian',
			bodyParts: {
				head: 1,
				arms: 2,
				legs: 2,
				spine: 1,
				what: 'am I doing actually?',
			},
		};

		expect(unmarshallItem(item)).toEqual({
			name: 'Damian',
			bodyParts: {
				head: 1,
				arms: 2,
				legs: 2,
				spine: 1,
				what: 'am I doing actually?',
			},
		});
	});

	it('Should handle array with nested objects and arrays', () => {
		const item = {
			name: 'Damian',
			children: [
				{
					name: 'Barbara',
					favColors: ['pink', 'blue'],
				},
				{
					name: 'Helena',
					favColors: ['red'],
				},
			],
		};

		expect(unmarshallItem(item)).toEqual({
			name: 'Damian',
			children: [
				{
					name: 'Barbara',
					favColors: ['pink', 'blue'],
				},
				{
					name: 'Helena',
					favColors: ['red'],
				},
			],
		});
	});

	it('Should handle objects with nested objects and arrays', () => {
		const item = {
			name: 'Damian',
			family: {
				children: ['Barbara', 'Helena'],
				wife: {
					name: 'Olga',
				},
			},
		};

		expect(unmarshallItem(item)).toEqual({
			name: 'Damian',
			family: {
				children: ['Barbara', 'Helena'],
				wife: {
					name: 'Olga',
				},
			},
		});
	});

	it('Should unmarshall Date ISO Strings to Date Objects', () => {
		const date = new Date(1985, 12, 29);
		const item = {
			name: 'Damian',
			birthday: date.toISOString(),
		};

		expect(unmarshallItem(item)).toEqual({
			name: 'Damian',
			birthday: date,
		});

		expect(unmarshallItem(item).birthday).toBeInstanceOf(Date);
	});

	it('Should unmarshall Date ISO Strings to Date Objects in nested properties', () => {
		const damianDate = new Date(1985, 12, 29);
		const barbaraDate = new Date(2018, 12, 23);
		const helenaDate = new Date(2021, 9, 1);
		const olgaDate = new Date(1986, 10, 29);
		const item = {
			name: 'Damian',
			birthday: damianDate.toISOString(),
			family: {
				children: [
					{
						name: 'Barbara',
						birthday: barbaraDate.toISOString(),
					},
					{
						name: 'Helena',
						birthday: helenaDate.toISOString(),
					},
				],
				wife: {
					name: 'Olga',
					birthday: olgaDate.toISOString(),
				},
			},
		};

		const unmarshalled = unmarshallItem(item);

		expect(unmarshalled).toEqual({
			name: 'Damian',
			birthday: damianDate,
			family: {
				children: [
					{
						name: 'Barbara',
						birthday: barbaraDate,
					},
					{
						name: 'Helena',
						birthday: helenaDate,
					},
				],
				wife: {
					name: 'Olga',
					birthday: olgaDate,
				},
			},
		});

		expect(unmarshalled.birthday).toBeInstanceOf(Date);
		expect(unmarshalled.family.children[0].birthday).toBeInstanceOf(Date);
		expect(unmarshalled.family.children[1].birthday).toBeInstanceOf(Date);
		expect(unmarshalled.family.wife.birthday).toBeInstanceOf(Date);
	});

	it('Should NOT unmarshall invalid Date ISO Strings to Date Objects', () => {
		const item = {
			name: 'Damian',
			birthday: '1985-12-29',
		};

		const unmarshalled = unmarshallItem(item);
		expect(unmarshalled.birthday).toBeTypeOf('string');
		expect(unmarshalled.birthday).not.toBeInstanceOf(Date);
	});
});
