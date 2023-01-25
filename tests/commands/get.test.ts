import { vi, describe, it, beforeEach, expect, afterEach } from 'vitest';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { GetResult, GetItemCommand } from '../../src/commands/get';
import { connect } from '../../src/mock';

type Test = {
	id: string;
	name: string;
	orgId: string;
	smth?: string;
	email?: string;
	pk?: string;
	sk?: string;
};

const mockClient = connect('eu-west-1');

const TestEntity = mockClient.defineEntity<Test>({
	name: 'TEST',
	computed: {
		pk: {
			dependsOn: ['id'],
			get: (item) => `TEST#${item.id}`,
		},
		sk: {
			dependsOn: ['email'],
			get: (item) => (item.email ? `EMAIL#${item.email}` : undefined),
		},
	},
});

const table = mockClient.defineTable({
	name: 'TestTable',
	primaryKey: 'pk',
	sortKey: 'sk',
	indexes: {
		ByEmail: {
			primaryKey: 'orgId',
			sortKey: 'email',
		},
	},
	entities: [TestEntity],
});

describe('GetItemCommand', () => {
	let cmd: GetItemCommand;

	const created = new Date();
	const updated = new Date();

	beforeEach(() => {
		mockClient.DbClientSendMock.mockResolvedValue({
			Item: {
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
				smth: 'something',
				_created: created.toISOString(),
				_updated: updated.toISOString(),
				_type: 'TEST',
				pk: 'TEST#12345',
				sk: 'EMAIL#damian@acme.com',
			},
		});

		cmd = new GetItemCommand(mockClient, table, {
			pk: 'pk-value',
			sk: 'sk-value',
		});
	});

	afterEach(() => {
		mockClient.clearMocks();
	});

	it('Should return instance of GetItemCommand on creation', () => {
		expect(cmd).toBeInstanceOf(GetItemCommand);
	});

	it('Should send GetCommand to the dbClient', async () => {
		await cmd.send();
		expect(mockClient.DbClientSendMock).toHaveBeenCalledTimes(1);
		expect(mockClient.DbClientSendMock.mock.lastCall![0]).toBeInstanceOf(GetCommand);
	});

	it('Should create GetCommand with a proper input', async () => {
		await cmd.send();
		const getCmd = mockClient.DbClientSendMock.mock.lastCall![0];

		expect(getCmd.input).toEqual({
			TableName: 'TestTable',
			Key: {
				pk: 'pk-value',
				sk: 'sk-value',
			},
		});
	});

	it('Should send command and return GetResult', async () => {
		const res = await cmd.send();
		expect(res).toBeInstanceOf(GetResult);
	});

	it('The result should return instance of the matching item', async () => {
		const res = await cmd.send();
		expect(res.item<Test>()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created,
			_updated: updated,
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});

	it('Returned instance should have functioning computed properties', async () => {
		const res = await cmd.send();
		const record = res.item<Test>()!;

		expect(record.pk).toBe('TEST#12345');

		record.id = '0987';
		expect(record.pk).toBe('TEST#0987');
	});

	it('Should return null if no record found', async () => {
		mockClient.DbClientSendMock.mockResolvedValue({ Item: undefined });

		const res = await cmd.send();
		expect(res.item<Test>()).toBe(null);
	});

	it('Should throw if Item is missing _type attribute', async () => {
		mockClient.DbClientSendMock.mockResolvedValue({
			Item: {
				id: '12345',
				name: 'Damian',
				orgId: 'ACME',
				email: 'damian@acme.com',
			},
		});

		const res = await cmd.send();

		expect(() => {
			res.item<Test>();
		}).toThrowError();
	});

	it('The result should return raw data object from the output', async () => {
		const res = await cmd.send();
		expect(res.raw()).toEqual({
			id: '12345',
			name: 'Damian',
			orgId: 'ACME',
			email: 'damian@acme.com',
			smth: 'something',
			_created: created.toISOString(),
			_updated: updated.toISOString(),
			_type: 'TEST',
			pk: 'TEST#12345',
			sk: 'EMAIL#damian@acme.com',
		});
	});
});
