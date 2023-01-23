import { GetCommand, GetCommandInput } from '@aws-sdk/lib-dynamodb';

import type { GetCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { EntityRecord } from '../entity';
import { unmarshallItem } from '../marshall';
import type { Table } from '../table';
import { Command, Result } from './base';
import { DbClient } from 'src/client';

export class GetItemCommand extends Command<GetCommandInput, GetCommandOutput, GetResult> {
	key: Record<string, string>;

	constructor(db: DbClient, table: Table, key: Record<string, string>) {
		super(db, table);
		this.key = key;
	}

	input(): GetCommandInput {
		return {
			TableName: this.table.config().name,
			Key: this.key,
		}; // TODO: Merge with options
	}

	async send(): Promise<GetResult> {
		const output: GetCommandOutput = await this.db.send(new GetCommand(this.input()));
		return new GetResult(output, this.table);
	}
}

export class GetResult extends Result<GetCommandOutput> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Item) {
			const entityType = this.output.Item._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Item) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Item;
	}
}
