import type {
	DynamoDBDocumentClient,
	GetCommandInput,
	QueryCommandInput,
	PutCommandInput,
	UpdateCommandInput,
	DeleteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import { DeleteItemCommand, GetItemCommand, PutItemCommand, QueryItemsCommand, UpdateItemCommand } from './commands';
import { calculateUpdateData, Entity, EntityRecord } from './entity';
import { marshallItem } from './marshall';

export type TableConfig = {
	name: string;
	primaryKey: string;
	sortKey?: string;
	entities: Entity<any>[];
	indexes?: Record<
		string,
		{
			primaryKey: string;
			sortKey?: string;
		}
	>;
};

export type Key = {
	primaryKey: string;
	sortKey?: string;
};

export type UpdateData = {
	set?: Record<string, NativeAttributeValue>;
	remove?: string[];
};

const matchKeyToTable = (key: Key, config: TableConfig): Record<string, NativeAttributeValue> => {
	const matchedKey: Record<string, NativeAttributeValue> = {};
	matchedKey[config.primaryKey] = key.primaryKey;
	if (config.sortKey) {
		if (!key.sortKey) {
			throw new Error('Missing sortkey for the table operation!');
		}
		matchedKey[config.sortKey] = key.sortKey;
	}
	return matchedKey;
};

const updateDataToInput = (
	updateData: UpdateData,
): Pick<UpdateCommandInput, 'UpdateExpression' | 'ExpressionAttributeNames' | 'ExpressionAttributeValues'> => {
	const updatedFields = Object.keys(updateData.set || {});
	const removedFields = updateData.remove || [];

	let updateExpression = '';
	let attributesNames: Record<string, string> = {};
	let attributesValues: Record<string, NativeAttributeValue> = {};

	if (updatedFields.length > 0) {
		updateExpression += ' SET ';
		updateExpression += updatedFields
			.map((field) => {
				return `#${field} = :${field}`;
			})
			.join(', ');
	}

	if (removedFields.length > 0) {
		updateExpression += ' REMOVE ';
		updateExpression += removedFields
			.map((field) => {
				return `#${field}`;
			})
			.join(', ');
	}

	Object.entries(updateData.set || {}).forEach(([field, value]) => {
		attributesNames[`#${field}`] = field;
		attributesValues[`:${field}`] = value;
	});
	removedFields.forEach((field) => {
		attributesNames[`#${field}`] = field;
	});

	return {
		UpdateExpression: updateExpression.trim(),
		ExpressionAttributeNames: attributesNames,
		ExpressionAttributeValues: marshallItem(attributesValues),
	};
};

type Commands = {
	GetItemCommand: typeof GetItemCommand;
	PutItemCommand: typeof PutItemCommand;
	QueryItemsCommand: typeof QueryItemsCommand;
	UpdateItemCommand: typeof UpdateItemCommand;
	DeleteItemCommand: typeof DeleteItemCommand;
};

export class Table {
	_config: TableConfig;
	_db: DynamoDBDocumentClient;
	_commands: Commands;
	_entities: Record<string, Entity<any>>;

	constructor(db: DynamoDBDocumentClient, config: TableConfig, commands: Commands) {
		this._config = config;
		this._db = db;
		this._commands = commands;
		this._entities = Object.fromEntries(
			config.entities.map((entityConstructor) => {
				return [entityConstructor.entityName, entityConstructor];
			}),
		);
	}

	dbClient() {
		return this._db;
	}

	entity<T extends object>(type: string): Entity<T> | null {
		return this._entities[type] || null;
	}

	config(): TableConfig {
		return this._config;
	}

	get(key: Key): GetItemCommand {
		const input: GetCommandInput = {
			TableName: this._config.name,
			Key: matchKeyToTable(key, this._config),
		};

		return new this._commands.GetItemCommand(this._db, input, this);
	}

	query(condition: string, values: Record<string, NativeAttributeValue>): QueryItemsCommand {
		const attributesNames = Object.fromEntries(Object.keys(values).map((key) => [`#${key}`, key]));
		const attributesValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [`:${key}`, value]));

		const input: QueryCommandInput = {
			TableName: this._config.name,
			KeyConditionExpression: condition,
			ExpressionAttributeNames: attributesNames,
			ExpressionAttributeValues: attributesValues,
		};

		return new this._commands.QueryItemsCommand(this._db, input, this);
	}
	put(record: EntityRecord): PutItemCommand {
		record._created = new Date();
		record._updated = new Date();
		const input: PutCommandInput = {
			TableName: this._config.name,
			Item: marshallItem(record),
		};
		return new this._commands.PutItemCommand(this._db, input, this);
	}
	update(record: EntityRecord): UpdateItemCommand {
		const primaryKey = (record as any)[this._config.primaryKey];
		if (!primaryKey) {
			throw new Error(`Entity is missing ${this._config.primaryKey} attribute that is used as PrimaryKey!`);
		}
		const key: Key = {
			primaryKey: primaryKey,
		};

		if (this._config.sortKey) {
			const sortKey = (record as any)[this._config.sortKey];
			if (!sortKey) {
				throw new Error(`Entity is missing ${this._config.sortKey} attribute that is used as SortKey!`);
			}
			key.sortKey = sortKey;
		}
		record._updated = new Date();
		const updateData = calculateUpdateData(record);

		return this.updateById(key, updateData);
	}

	updateById(key: Key, updateData: UpdateData): UpdateItemCommand {
		const updateInput = updateDataToInput(updateData);
		const input: UpdateCommandInput = {
			TableName: this._config.name,
			Key: matchKeyToTable(key, this._config),
			ReturnValues: 'ALL_NEW',
			...updateInput,
		};

		return new this._commands.UpdateItemCommand(this._db, input, this);
	}

	delete(record: EntityRecord): DeleteItemCommand {
		const key: Key = {
			primaryKey: (record as any)[this._config.primaryKey],
		};
		if (!key.primaryKey) {
			throw new Error(`Entity is missing ${this._config.primaryKey} attribute that is used as PrimaryKey!`);
		}

		if (this._config.sortKey) {
			key.sortKey = (record as any)[this._config.sortKey];
			if (!key.sortKey) {
				throw new Error(`Entity is missing ${this._config.sortKey} attribute that is used as SortKey!`);
			}
		}
		return this.deleteById(key);
	}
	deleteById(key: Key): DeleteItemCommand {
		const input: DeleteCommandInput = {
			TableName: this._config.name,
			Key: matchKeyToTable(key, this._config),
			ReturnValues: 'ALL_OLD',
		};

		return new this._commands.DeleteItemCommand(this._db, input, this);
	}
	send(): void {}
}

export const defineTable = (db: DynamoDBDocumentClient, config: TableConfig): Table => {
	return new Table(db, config, {
		GetItemCommand,
		UpdateItemCommand,
		QueryItemsCommand,
		DeleteItemCommand,
		PutItemCommand,
	});
};
