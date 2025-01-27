const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const fs = require('fs');
const Joi = require('joi');
const { nanoid } = require('nanoid');

const app = express();

// Middleware
app.use(logger('dev'));
app.use(cors());
app.use(express.json());

const path = require('path');
const contactsFilePath = path.join(__dirname, 'models', 'contacts.json');

const listContacts = () => {
  try {
    const data = fs.readFileSync(contactsFilePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading contacts file:', err);
    throw new Error('Could not read contacts data');
  }
};

const writeContacts = (contacts) => {
  try {
    fs.writeFileSync(contactsFilePath, JSON.stringify(contacts, null, 2));
  } catch (err) {
    console.error('Error writing contacts file:', err);
    throw new Error('Could not write contacts data');
  }
};

const contactSchema = Joi.object({
  name: Joi.string().min(3).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^[0-9]+$/).required(),
});

app.get('/api/contacts', (req, res) => {
  const contacts = listContacts();
  res.status(200).json(contacts);
});

const getById = (id) => {
  const contacts = listContacts();
  return contacts.find(contact => contact.id === id);
};

app.get('/api/contacts/:id', (req, res) => {
  const contact = getById(req.params.id);

  if (contact) {
    res.status(200).json(contact);
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

const addContact = (contact) => {
  const contacts = listContacts();
  contacts.push(contact);
  writeContacts(contacts);
};

app.post('/api/contacts', (req, res) => {
  const { name, email, phone } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'missing required name field' });
  }
  if (!email) {
    return res.status(400).json({ message: 'missing required email field' });
  }
  if (!phone) {
    return res.status(400).json({ message: 'missing required phone field' });
  }

  const { error } = contactSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const newContact = {
    id: nanoid(),
    ...req.body,
  };

  addContact(newContact);
  res.status(201).json(newContact);
});

const removeContact = (id) => {
  const contacts = listContacts();
  const contactIndex = contacts.findIndex(contact => contact.id === id);

  if (contactIndex !== -1) {
    contacts.splice(contactIndex, 1);
    writeContacts(contacts);
    return true;
  }
  return false;
};

app.delete('/api/contacts/:id', (req, res) => {
  const contactId = req.params.id;
  const isDeleted = removeContact(contactId);

  if (isDeleted) {
    res.status(200).json({ message: 'Contact deleted' });
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

const updateContact = (contactId, updatedData) => {
  const contacts = listContacts();
  const contactIndex = contacts.findIndex(contact => contact.id === contactId);

  if (contactIndex !== -1) {
    contacts[contactIndex] = { ...contacts[contactIndex], ...updatedData };
    writeContacts(contacts);
    return contacts[contactIndex];
  }
  return null; 
};

app.put('/api/contacts/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  if (!name && !email && !phone) {
    return res.status(400).json({ message: 'Missing required name, email, or phone field' });
  }

  const { error } = contactSchema.validate(req.body);

  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  const updatedContact = updateContact(id, req.body);

  if (updatedContact) {
    res.status(200).json(updatedContact);
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});
app.use((req, res) => {
  res.status(404).json({ message: 'Not found' });
});

app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = app;

