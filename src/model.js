const {Datastore} = require('@google-cloud/datastore');
const datastore = new Datastore();

class EntityValidationError extends Error {}

/**
 * Defines common data validation methods for Datastore Entities.
 */
class Entity {
    /**
     * 
     * @returns true if any of the instance's properties are undefined, else false
     */

    constructor() {
        this.validationMethods = {
            minLength: (str, min) => {return str.length < min},
            maxLength: (str, max) => {return str.length > max},
            minVal: (num, min) => {return num < min},
            maxVal: (num, max) => {return num > max},
            ofForm: (str, re) => {return str.test(re)}
        }
    }

    getEntityData() {
        throw Error("This method is not implemented 30 parent and should be overridden.")
    }

    propsAreMissing() {
        return Object.values(this).reduce((acc, cur)=>acc || cur === undefined, false);
    }

    propFailsValidationRules() {
        for (const [prop, rules] of Object.entries(this.validation)) {
            for (const [rule, allowedValue] of Object.entries(rules)) {
                const validationRule = this.validationMethods[rule];
                const actualValue = this[prop];
                if (validationRule(actualValue, allowedValue)) {
                    return true;
                }
            }
        }
        return false;
    }

    instanceIsInvalid() {
        return this.propsAreMissing() || this.propFailsValidationRules();
    }
    
}

/**
 * Defines data structure to use when creating a new boat.
 */
class Boat extends Entity{
    /**
     * 
     * @param {string} name 
     * @param {string} type 
     * @param {int} length
     * @param {string} user 
     */
    constructor({name, type, length, user}) {
        super();
        // Signature defines required properties. Missing will be undefined.
        this.name = name;
        this.type = type;
        this.length = length;
        this.user = user;
        this.validation = {
            name: {
                minLength: 1,
                maxLength: 50
            },
            type: {
                minLength: 1,
                maxLength: 50
            },
            length: {
                minVal: 1,
                maxVal: 9999
            }
        }
        if (this.instanceIsInvalid()) throw new EntityValidationError(`Boat instance failed to initiate with properties name: ${name}, type: ${type}, length: ${length}`);
    }

    getEntityData() {
        return {name: this.name, type: this.type, length: this.length, user: this.user}
    }
}

class Load extends Entity{
    constructor({volume, item, creation_date, user}) {
        super();
        this.volume = volume;
        this.item = item;
        this.creation_date = creation_date;
        this.user = user;
        this.validation = {
            volume: {
                minVal: 1,
                maxVal: 9999
            }, 
            item: {
                minLength: 1,
                maxLength: 50
            },
            creation_date: {
                ofForm: /^\d{2}\/\d{2}\/\d{4}$/
            }
        }
        if (this.instanceIsInvalid()) throw new EntityValidationError(`Load instance failed to initiate with properties volume: ${volume}, item: ${item}, creation_date: ${creation_date}`);
    }

    getEntityData() {
        return {volume: this.volume, item: this.item, creation_date: this.creation_date, user: this.user}
    }
}

/****************************************************************
 *                                                              *
 *                      DATABASE FUNCTIONS                      *
 *                                                              *
 ****************************************************************/
/**
 * Adds a new boat to the database.
 * 
 * @param {object} Object containing all boat properties
 * 
 * @returns new boat, or false if error.
 */
async function createEntity(kind, entityData) {
    const newInstance = {
        "Boat": () => {return new Boat(entityData)},
        "Load": () => {return new Load(entityData)}
    }[kind]();
    const newEntity = {
        key: datastore.key(kind),
        data: newInstance.getEntityData()
    }
    try {
        await datastore.save(newEntity);
        return await getEntity(kind, newEntity.key.id);
    } catch(err) {
        console.error(err);
        return false;
    }
}

/**
 * Retrieves an entity of the given kind with the given id from database.
 * 
 * @param {string} kind
 * @param {string} entityId 
 * @returns matching object, or false if not found
 */
async function getEntity(kind, entityId) {
    const key = datastore.key([kind, datastore.int(entityId)]);
    try {
        const [retrievedEntity] = await datastore.get(key);
        retrievedEntity.id = retrievedEntity[Datastore.KEY].id;
        return retrievedEntity;
    } catch (err) {
        console.error(err);
        return false;
    }
}

/**
 * Retrieves all entities of the given kind from the database.
 * 
 * @param {string} kind
 * @returns list of objects, or error.
 */
async function getAllEntities(kind) {
    const query = datastore.createQuery(kind);
    try {
        const [entities] = await datastore.runQuery(query);
        entities.forEach((entity) => entity.id = entity[Datastore.KEY].id);
        return entities;
    } catch (err) {
        console.error(err);
        return err
    }
}

/**
 * Updates the datastore-retrieved entity object to have the object's current properties.
 * 
 * @param {object} entity: previously retrieved from datastore (has KEY Symbol)
 * @returns true if successful, false if error
 */
async function updateEntity(entity) {
    try {
        await datastore.save(entity);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

/**
 * Deletes the given entity from the database.
 * 
 * @param {object} entity: previously retrieved from datastore (has KEY Symbol)
 * @returns true if successful, false if error
 */
async function deleteEntity(entity) {
    try {
        await datastore.delete(entity[Datastore.KEY]);
        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
}

module.exports = {
    getEntity,
    createEntity,
    getAllEntities,
    updateEntity,
    deleteEntity,
    EntityValidationError,
};