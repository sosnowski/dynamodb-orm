import type {
	DynamoDBDocumentClient,
	GetCommandInput,
	QueryCommandInput,
	PutCommandInput,
	UpdateCommandInput,
	DeleteCommandInput,
} from '@aws-sdk/lib-dynamodb';
import type { NativeAttributeValue } from '@aws-sdk/util-dynamodb';
import { DbClient } from './client';
import { DeleteItemCommand } from './commands/delete';
import { GetItemCommand } from './commands/get';
import { PutItemCommand } from './commands/put';
import { QueryItemsCommand } from './commands/query';
import { UpdateItemCommand } from './commands/update';
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

type Commands = {
	GetItemCommand: typeof GetItemCommand;
	PutItemCommand: typeof PutItemCommand;
	QueryItemsCommand: typeof QueryItemsCommand;
	UpdateItemCommand: typeof UpdateItemCommand;
	DeleteItemCommand: typeof DeleteItemCommand;
};

export class Table {
	_config: TableConfig;
	_db: DbClient;
	_commands: Commands;
	_entities: Record<string, Entity<any>>;
	name: string;

	constructor(db: DbClient, config: TableConfig, commands: Commands) {
		this.name = config.name;
		this._config = config;
		this._db = db;
		this._commands = commands;
		this._entities = Object.fromEntries(
			config.entities.map((entityConstructor) => {
				return [entityConstructor.entityName, entityConstructor];
			}),
		);
	}

	entity<T extends object>(type: string): Entity<T> | null {
		return this._entities[type] || null;
	}

	config(): TableConfig {
		return this._config;
	}

	get(key: Key): GetItemCommand {
		return new this._commands.GetItemCommand(this._db, this, matchKeyToTable(key, this._config));
	}

	query(condition: string, values: Record<string, NativeAttributeValue>): QueryItemsCommand {
		return new this._commands.QueryItemsCommand(this._db, this, condition, values);
	}
	put(record: EntityRecord): PutItemCommand {
		record._created = new Date();
		record._updated = new Date();
		return new this._commands.PutItemCommand(this._db, this, marshallItem(record));
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
		return new this._commands.UpdateItemCommand(this._db, this, matchKeyToTable(key, this._config), updateData);
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
		const cmd = new this._commands.DeleteItemCommand(this._db, this, matchKeyToTable(key, this._config));
		cmd.returnOld();
		return cmd;
	}
}
