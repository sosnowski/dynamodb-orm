import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import type { UpdateData } from './table';

enum ValueInfo {
	New = 'New',
	Updated = 'Updated',
	Removed = 'Removed',
}

const metaDataKey = Symbol.for('entityMetadata');
type EntityMetada = {
	changes: Record<string, ValueInfo>;
	attrDeps: Record<string, string[]>;
};

export type EntityRecord = {
	_updated: Date;
	_created: Date;
	_expires?: Date;
	readonly _ttl?: number;
	readonly _type: string;
};

export type Entity<T extends object> = {
	(data: T): T & EntityRecord;
	entityName: string;
};

export type ComputedGetter<R> = {
	dependsOn?: (keyof R)[];
	get: (target: R) => unknown;
};

export type EntityConfig<R> = {
	name: string;
	ttl?: string;
	computed?: Partial<{
		[Attr in keyof R]: ComputedGetter<R>;
	}>;
};

const updateDepsAttrs = (prop: string, metaData: EntityMetada) => {
	if (metaData.attrDeps[prop]) {
		metaData.attrDeps[prop].forEach((depAttr) => {
			metaData.changes[depAttr] = ValueInfo.Updated;
		});
	}
};

const wrapProxy = <T extends object>(
	target: T,
	metaData: EntityMetada,
	// computed?: Record<string, ComputedGetter<T & EntityRecord>>,
	parentKey?: string,
): T => {
	const isArray = Array.isArray(target);

	let toWrap;
	if (!isArray && typeof target === 'object' && target !== null) {
		toWrap = target;
		for (const [key, value] of Object.entries(target)) {
			if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
				// nested objects don't access computed properties
				(toWrap as any)[key] = wrapProxy(value, metaData, parentKey ? parentKey : key);
			}
		}
	} else if (isArray) {
		toWrap = (target as any[]).map((value) => {
			if (typeof value === 'object' && value !== null) {
				// nested objects don't access computed properties
				return wrapProxy(value, metaData, parentKey);
			} else {
				return value;
			}
		});
	}

	return new Proxy<T>(toWrap as T, {
		// get(target: T, prop: string, receiver) {
		// 	if (computed?.hasOwnProperty(prop)) {
		// 		console.log('Computed getter ', prop);
		// 		return computed[prop].get(receiver);
		// 	} else {
		// 		console.log('Original getter', prop);
		// 		return Reflect.get(target, prop, target);
		// 	}
		// },
		set(target, prop: string, value, receiver) {
			// console.log('Setter', prop, value);
			const setToUndefined = value === undefined && (target as any)[prop] !== undefined;
			const setterRes = Reflect.set(target, prop, value, receiver);
			if (setterRes && typeof prop === 'string' && (!isArray || prop !== 'length')) {
				metaData.changes[parentKey || prop] = setToUndefined ? ValueInfo.Removed : ValueInfo.Updated;
				updateDepsAttrs(prop, metaData);
			}
			return setterRes;
		},
		deleteProperty(target, prop: string) {
			// console.log('Deleter', prop);
			const deleterRes = Reflect.deleteProperty(target, prop);
			if (deleterRes) {
				if (parentKey) {
					metaData.changes[parentKey] = ValueInfo.Updated;
				} else {
					metaData.changes[prop] = ValueInfo.Removed;
				}
				updateDepsAttrs(prop, metaData);
			}
			return deleterRes;
		},
	});
};

export const defineEntity = <T extends object>(config: EntityConfig<T & EntityRecord>): Entity<T> => {
	config.ttl = config.ttl || '_ttl';
	const computed: Record<string, ComputedGetter<T & EntityRecord>> = {
		...(config.computed || {}),
		[config.ttl]: {
			dependsOn: ['_expires'],
			get: (entity) => (entity._expires ? entity._expires.getTime() : undefined),
		},
	};
	const entityConstructor = (data: T): T & EntityRecord => {
		const metaData: EntityMetada = {
			changes: {},
			attrDeps: {},
		};
		const target = {
			_created: new Date(),
			_updated: new Date(),
			_type: config.name,
			...data,
		};

		Object.defineProperty(target, metaDataKey, {
			enumerable: false,
			writable: false,
			configurable: false,
			value: metaData,
		});

		for (let [key, getter] of Object.entries(computed)) {
			if (getter.dependsOn && getter.dependsOn.length > 0) {
				//store computed fields dependencies in a reversed form (changed -> affected)
				getter.dependsOn.forEach((depends) => {
					const depKey = depends as string;
					if (!metaData.attrDeps[depKey]) {
						metaData.attrDeps[depKey] = [];
					}
					metaData.attrDeps[depKey].push(key);
				});
			}
			Object.defineProperty(target, key, {
				enumerable: true,
				get() {
					// console.log(`Computed getter for ${key}!`);
					return getter.get(target);
				},
			});
		}
		const wrapped = wrapProxy(target, metaData);
		return wrapped;
	};

	entityConstructor.entityName = config.name;

	return entityConstructor;
};

export const calculateUpdateData = (record: EntityRecord): UpdateData => {
	const meta = (record as any)[metaDataKey];
	if (!meta) {
		throw new Error('Provided entity does not have entity metadata attribute');
	}

	// console.log(meta);

	const updatedFields: Record<string, NativeAttributeValue> = Object.fromEntries(
		Object.entries(meta.changes)
			.filter(([attr, valueInfo]) => {
				return valueInfo === ValueInfo.Updated && record.hasOwnProperty(attr);
			})
			.map(([attr]) => [attr, (record as any)[attr]]),
	);

	const removedFields = Object.entries(meta.changes)
		.filter(([_key, valueInfo]) => {
			return valueInfo === ValueInfo.Removed;
		})
		.map(([key, _value]) => key);
	return {
		set: updatedFields,
		remove: removedFields,
	};
};
