import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb';

import type { PutCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { EntityRecord } from '../entity';
import { unmarshallItem } from '../marshall';
import type { Table } from '../table';
import { Command, Result } from './base';
import { DbClient } from 'src/client';

export class PutItemCommand extends Command<PutCommandInput, PutCommand, PutCommandOutput, PutResult> {
	item: Record<string, any>;
	constructor(db: DbClient, table: Table, item: Record<string, string>) {
		super(db, table);
		this.item = item;
	}

	send(): Promise<PutResult> {
		return this.db.sendCommand(this);
	}

	result(output: PutCommandOutput): PutResult {
		return new PutResult(output, this.table);
	}
	command(): PutCommand {
		return new PutCommand({
			TableName: this.table.name,
			Item: this.item,
		});
	}

	returnOld(): PutItemCommand {
		this.opts.ReturnValues = 'ALL_OLD';
		return this;
	}
	//TODO condition etc
}

export class PutResult extends Result<PutCommandOutput> {
	item<T extends object>(): (T & EntityRecord) | null {
		if (this.output.Attributes) {
			const entityType = this.output.Attributes._type;
			if (entityType && this.table.entity(entityType)) {
				const entity = this.table.entity<T>(entityType)!;
				return entity(unmarshallItem(this.output.Attributes) as T);
			} else {
				throw Error('Item does not have _type property or missing entity with such type :' + entityType);
			}
		}
		return null;
	}

	raw(): Record<string, any> | undefined {
		return this.output.Attributes;
	}
}
