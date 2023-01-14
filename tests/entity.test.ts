import { describe, it, expect, beforeEach } from 'vitest';
import { calculateUpdateData, defineEntity } from 'src/entity';

type Test = {
	name: string;
	login: string;
	email?: string;
	birthdate: Date;
	favColors: string[];
	address?: {
		city: string;
		street: string;
	};
	pk?: string;
	age?: number;
};

const TestEntity = defineEntity<Test>({
	name: 'TEST',
	computed: {
		pk: {
			dependsOn: ['login'],
			get: (item) => `TEST#${item.login}`,
		},
		age: {
			dependsOn: ['birthdate'],
			get: (item) => new Date(2023, 1, 4).getFullYear() - item.birthdate.getFullYear(),
		},
	},
});

describe('Entity creation and attributes', () => {
	let data: Test = {
		name: 'Damian',
		login: 'damsos',
		birthdate: new Date(1985, 12, 29),
		favColors: ['black', 'red'],
	};

	let user: ReturnType<typeof TestEntity>;

	beforeEach(() => {
		user = TestEntity(data);
	});

	it('Should create entity instance', () => {
		expect(user).not.toBeNull();
		expect(user).toBeTypeOf('object');
	});

	it('Should attach default entity timestamps', () => {
		expect(user._created).toBeInstanceOf(Date);
		expect(user._updated).toBeInstanceOf(Date);
	});

	it('Should attach proper entity type', () => {
		expect(user._type).toBe('TEST');
	});

	it('Should have valid attributes as the initial data', () => {
		expect(user.name).toBe('Damian');
		expect(user.login).toBe('damsos');
		expect(user.birthdate.getTime()).toBe(new Date(1985, 12, 29).getTime());
		expect(user.favColors).toEqual(['black', 'red']);
	});

	it('Should return proper computed properties', () => {
		expect(user.pk).toBe('TEST#damsos');
		expect(user.age).toBe(37);
	});

	it('Should not set expiry date or TTL by default', () => {
		expect(user._expires).toBeUndefined();
		expect(user._ttl).toBeUndefined();
	});

	it('Should present itself as a normal object and not expose metadata', () => {
		const created = user._created;
		const updated = user._updated;
		expect(user).toEqual({
			name: 'Damian',
			login: 'damsos',
			birthdate: new Date(1985, 12, 29),
			favColors: ['black', 'red'],
			_ttl: undefined,
			_created: created,
			_updated: updated,
			_type: 'TEST',
			pk: 'TEST#damsos',
			age: 37,
		});
	});

	it('Should properly calculate TTL for the expiration date', () => {
		const date = new Date(2030, 1, 1);
		user._expires = date;
		expect(user._ttl).toBe(date.getTime());
	});

	it('Should not be possible to change computed property', () => {
		expect(() => {
			user.pk = 'something';
		}).toThrowError();
		expect(user.pk).toBe('TEST#damsos');
	});
});

describe('Tracking entity attributes updates', () => {
	let user: ReturnType<typeof TestEntity>;

	beforeEach(() => {
		user = TestEntity({
			name: 'Damian',
			login: 'damsos',
			email: 'dam@wp.pl',
			birthdate: new Date(1985, 12, 29),
			favColors: ['black', 'red'],
			address: {
				city: 'Lisbon',
				street: 'Avenida',
			},
		});
	});

	it('Should return empty set of changes for untouched entity', () => {
		const changes = calculateUpdateData(user);
		expect(changes).toEqual({
			set: {},
			remove: [],
		});
	});

	it('Should mark simple field as changed after update', () => {
		user.name = 'Gucio';

		const changes = calculateUpdateData(user);
		expect(changes).toEqual({
			set: {
				name: 'Gucio',
			},
			remove: [],
		});
	});

	it('Should track changes per instance, in isolation', () => {
		const user2 = TestEntity({
			name: 'Tomasz',
			login: 'tomsos',
			birthdate: new Date(1985, 12, 29),
			favColors: ['black', 'red'],
		});

		user.name = 'Gucio';

		expect(calculateUpdateData(user)).toEqual({
			set: {
				name: 'Gucio',
			},
			remove: [],
		});

		expect(calculateUpdateData(user2)).toEqual({
			set: {},
			remove: [],
		});
	});

	it('Should mark field as removed when deleted', () => {
		delete user.address;

		expect(calculateUpdateData(user)).toEqual({
			set: {},
			remove: ['address'],
		});
	});

	it('Should mark field as removed when set to undefined', () => {
		user.email = undefined;

		expect(calculateUpdateData(user)).toEqual({
			set: {},
			remove: ['email'],
		});
	});

	it('Should mark array field as modified when element is added to the array', () => {
		user.favColors.push('gold');

		expect(calculateUpdateData(user)).toEqual({
			set: {
				favColors: ['black', 'red', 'gold'],
			},
			remove: [],
		});
	});

	it('Should mark array field as modified when array is updated', () => {
		user.favColors.splice(0, 1);

		expect(calculateUpdateData(user)).toEqual({
			set: {
				favColors: ['red'],
			},
			remove: [],
		});
	});

	it('Should mark object field as modified when object is updated', () => {
		user.address!.city = 'Belem';
		expect(calculateUpdateData(user)).toEqual({
			set: {
				address: {
					city: 'Belem',
					street: 'Avenida',
				},
			},
			remove: [],
		});
	});

	it('Should handle several updates at once', () => {
		user.name = 'Gucio';
		user.email = undefined;
		user.favColors.splice(0, 1);
		user.address!.city = 'Belem';

		expect(calculateUpdateData(user)).toEqual({
			set: {
				name: 'Gucio',
				favColors: ['red'],
				address: {
					city: 'Belem',
					street: 'Avenida',
				},
			},
			remove: ['email'],
		});
	});

	it('Should not mark computed fields as updated', () => {
		expect(() => {
			user.pk = 'something';
		}).toThrowError();
		expect(calculateUpdateData(user)).toEqual({
			set: {},
			remove: [],
		});
	});

	it('Should mark calculated field as updated after dependency is modified', () => {
		user.login = 'kucyk';

		expect(calculateUpdateData(user)).toEqual({
			set: {
				login: 'kucyk',
				pk: 'TEST#kucyk',
			},
			remove: [],
		});
	});
});
