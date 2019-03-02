import React, { useState } from 'react';

import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

import ValidIcon from '@material-ui/icons/CheckCircle';
import InvalidIcon from '@material-ui/icons/Error';

import * as jwt from 'jsonwebtoken';
import * as moment from 'moment';

export const Debugger = () => {
  const [voucher, setVoucher] = useState('');
  const { header, payload, isValid, errors } = verifyAndDecodeVoucher(voucher);

  return <>
    <TextField
      id="outlined-multiline-flexible"
      label="Voucher"
      placeholder="Enter voucher"
      autoFocus={true}
      InputLabelProps={{shrink: true}}
      multiline
      rowsMax="6"
      margin="normal"
      variant="outlined"
      fullWidth={true}
      value={voucher}
      onChange={(event) => setVoucher(event.target.value)}
    />
    {
      isValid && <>
        <Typography variant="h6">
          Voucher is valid
        </Typography>
      </>
    }
    {
      !isValid && <>
        <Typography variant="h6" gutterBottom={true}>
          Voucher is invalid
        </Typography>
        {
          errors && (errors.length > 0) &&
          errors.map((error, index) => <Typography key={index}>
            { error }
          </Typography>)
        }
      </>
    }
    { isValid && payload && <PayloadDescription {...payload} /> }
  </>;
};

interface IPayload {
  jti: string;
  val: string;
  aud: string;
  iss: string;

  crsid: string;

  iat?: number;
  nbf?: number;
  exp?: number;

  [key: string]: any;
};

interface IPayloadDescriptionProps extends IPayload { };

const formatTimestamp = (timestamp: number) => moment.unix(timestamp).utc().format('LLL');

const PayloadDescription = (
  { jti, val, aud, iss, crsid, iat, nbf, exp }: IPayloadDescriptionProps) => (
<Table>
  <TableHead>
    <TableRow>
      <TableCell>Claim</TableCell>
      <TableCell>Value</TableCell>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>Unique id</TableCell>
      <TableCell>{ jti }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Value</TableCell>
      <TableCell>{ val }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>User</TableCell>
      <TableCell>{ crsid }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Issuer</TableCell>
      <TableCell>{ ISSUER_MAP[iss].description }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Intended use</TableCell>
      <TableCell>{ aud }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Issued at</TableCell>
      <TableCell>{ iat ? formatTimestamp(iat) : '\u2014' }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Invalid before</TableCell>
      <TableCell>{ nbf ? formatTimestamp(nbf) : '\u2014' }</TableCell>
    </TableRow>
    <TableRow>
      <TableCell>Invalid after</TableCell>
      <TableCell>{ exp ? formatTimestamp(exp) : '\u2014' }</TableCell>
    </TableRow>
  </TableBody>
</Table>);

interface IVerifyAndDecodeResult {
  header?: { [key: string]: any; }
  payload?: IPayload;

  isValid: Boolean;

  errors?: string[];
};

const verifyAndDecodeVoucher = (voucher: string): IVerifyAndDecodeResult => {
  const errors: string[] = [];

  const unverifiedDecoding = jwt.decode(voucher, { complete: true });
  if(unverifiedDecoding === null) {
    errors.push('Voucher cannot be decoded.');
    return { isValid: false, errors };
  }

  const { header} = unverifiedDecoding as { header: { [key: string]: any } };
  if(!header || !header.iss) {
    errors.push('Header lacks "iss" claim');
    return { isValid: false, header, errors };
  }

  const issuer = ISSUER_MAP[header.iss];
  if(!issuer) {
    errors.push(`Voucher issuer "${header.iss}" is unknown`);
    return { isValid: false, header, errors };
  }

  if(!header || !header.aud) {
    errors.push('Header lacks "aud" claim');
    return { isValid: false, header, errors };
  }
  const audience = header.aud;

  if(!VALID_AUDIENCES.has(audience)) {
    errors.push(`Audience "${audience}" is unknown`);
    return { isValid: false, header, errors };
  }

  let payload = null;
  try {
    payload = jwt.verify(voucher, issuer.key, {
      algorithms:['ES256'], audience: audience, issuer: header.iss,
    }) as { [key: string]: any };
    if(!payload) {
      errors.push('Voucher has empty payload');
      return { isValid: false, header, errors };
    }
  } catch(error) {
    errors.push(`Voucher could not be verified: ${error.message}`);
    return { isValid: false, header, errors };
  }

  if(!payload.jti) {
    errors.push('Payload lacks "jti" claim');
    return { isValid: false, header, errors };
  }

  if(!payload.val) {
    errors.push('Payload lacks "val" claim');
    return { isValid: false, header, errors };
  }

  if(isNaN(Number(payload.val))) {
    errors.push('"val" claim could not be parsed as a number');
    return { isValid: false, header, errors };
  }

  return { isValid: true, header, payload: payload as IPayload, errors };
};

interface IIssuer {
  description?: string;
  key: string;
};

const VALID_AUDIENCES = new Set(['ssgw', 'ssge-dev', 'ssgw-test']);

const ISSUER_MAP: { [issuerId: string]: IIssuer } = {
  "ifs-test-iuph8yaith": {
    description: 'IFS Test',
    key: `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAER/JQFfpKZinH3btYjuoYTZ9dqodt
EmHWiOCaVXVg9X2xacp7DKMJDobv9vQhXHuBo+QkRnwfcgZ0mMgXL7QxDw==
-----END PUBLIC KEY-----`,
  },
  "ifs-live-eibah7hah8": {
    description: 'IFS Production',
    key: `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEbFSlXcqD9S4yBeV9UUPajH13Qo5j
iNQivxKBEUCX/fQ18XKhV7stCPTVX7lExw7RBJ3B/f42+S55jIrXlfqk9g==
-----END PUBLIC KEY-----`,
  },
};

export default Debugger;
