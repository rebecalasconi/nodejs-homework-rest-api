const fs = require('fs/promises');
const path = require('path');
const { nanoid } = require('nanoid');

const contactsFilePath = path.join(__dirname, 'contacts.json');

// Funcție pentru citirea contactelor din fișier
const listContacts = async () => {
  try {
    const data = await fs.readFile(contactsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading contacts file:', err);
    throw new Error('Could not read contacts data');
  }
};

// Funcție pentru obținerea unui contact după ID
const getContactById = async (contactId) => {
  try {
    const contacts = await listContacts();
    return contacts.find(contact => contact.id === contactId);
  } catch (err) {
    console.error('Error retrieving contact:', err);
    throw new Error('Could not retrieve contact');
  }
};

// Funcție pentru ștergerea unui contact după ID
const removeContact = async (contactId) => {
  try {
    const contacts = await listContacts();
    const contactIndex = contacts.findIndex(contact => contact.id === contactId);

    if (contactIndex !== -1) {
      contacts.splice(contactIndex, 1);
      await fs.writeFile(contactsFilePath, JSON.stringify(contacts, null, 2));
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error deleting contact:', err);
    throw new Error('Could not delete contact');
  }
};

// Funcție pentru adăugarea unui contact
const addContact = async (body) => {
  try {
    const contacts = await listContacts();
    const newContact = {
      id: nanoid(),
      ...body,
    };

    contacts.push(newContact);
    await fs.writeFile(contactsFilePath, JSON.stringify(contacts, null, 2));
    return newContact;
  } catch (err) {
    console.error('Error adding contact:', err);
    throw new Error('Could not add contact');
  }
};

// Funcție pentru actualizarea unui contact
const updateContact = async (contactId, body) => {
  try {
    const contacts = await listContacts();
    const contactIndex = contacts.findIndex(contact => contact.id === contactId);

    if (contactIndex !== -1) {
      contacts[contactIndex] = { ...contacts[contactIndex], ...body };
      await fs.writeFile(contactsFilePath, JSON.stringify(contacts, null, 2));
      return contacts[contactIndex];
    }
    return null;
  } catch (err) {
    console.error('Error updating contact:', err);
    throw new Error('Could not update contact');
  }
};

module.exports = {
  listContacts,
  getContactById,
  removeContact,
  addContact,
  updateContact,
};
