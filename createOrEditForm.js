import { useCallback, useEffect, useState } from 'react';
import * as Yup from 'yup';
import PropTypes from 'prop-types';
import { capitalCase } from 'change-case';
import { useSnackbar } from 'notistack5';
import { useNavigate } from 'react-router-dom';
import { Form, FormikProvider, useFormik } from 'formik';
import { Icon } from '@iconify/react';
import plusFill from '@iconify/icons-eva/plus-fill';
// material
import { styled, useTheme } from '@material-ui/core/styles';
import { DesktopDateRangePicker, LoadingButton, MobileDateRangePicker } from '@material-ui/lab';
import {
  Box,
  Button,
  Card,
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  TextField,
  Typography
} from '@material-ui/core';
// redux
import { useDispatch, useSelector } from '../../../redux/store';
import { getAllLocations } from '../../../redux/slices/locations';
import { addListing, editListing, getMyListings } from '../../../redux/slices/listings';
// hooks
import useAuth from '../../../hooks/useAuth';
// routes
import { PATH_DASHBOARD } from '../../../routes/paths';
//
import { MHidden } from '../../@material-extend';
import LocationNewAddressForm from '../locations/LocationNewAddressForm';
import { ASSET_TYPES, TRACTOR_BODY_TYPES, TRAILER_BODY_TYPES, TRUCK_BODY_TYPES } from '../../../constants/assets';
import LoadingScreen from '../../LoadingScreen';

// ----------------------------------------------------------------------

const LabelStyle = styled(Typography)(({ theme }) => ({
  ...theme.typography.subtitle2,
  color: theme.palette.text.secondary,
  marginBottom: theme.spacing(1)
}));

// ----------------------------------------------------------------------

ListingNewForm.propTypes = {
  isEdit: PropTypes.bool,
  currentListing: PropTypes.object
};

export default function ListingNewForm({ isEdit, currentListing }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { getAccessTokenSilently, idToken } = useAuth();
  const { locations, isLoading } = useSelector((state) => state.locations);
  const { myAssets } = useSelector((state) => state.assets);
  const dispatch = useDispatch();

  const [numberAvailable, setNumberAvailable] = useState(0);
  const [startEndDates, setStartEndDates] = useState([currentListing?.startAt || null, currentListing?.endAt || null]);
  const [openPickUp, setOpenPickUp] = useState(false);
  const [openDropOff, setOpenDropOff] = useState(false);

  const NewListingSchema = Yup.object().shape({
    description: Yup.string().max(500, 'Other details is too long. Max length is 500.'),
    alwaysAvailable: Yup.boolean(),
    startAt: Yup.string()
      .nullable()
      .when('alwaysAvailable', {
        is: false,
        then: Yup.string().required('Start date is required')
      }),
    endAt: Yup.string()
      .nullable()
      .when('alwaysAvailable', {
        is: false,
        then: Yup.string().required('End date is required')
      }),
    pickupLocationId: Yup.string().required('Pick up location is required'),
    dropoffLocationId: Yup.string().required('Drop off location is required'),
    pricePerIntervalCents: Yup.number().required('Price is required'),
    genericQuantity: Yup.number().min(1, '# of assets for listing required.')
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: currentListing?.title || '',
      description: currentListing?.description || '',
      pickupLocationId: currentListing?.pickupLocationId || '',
      pickupInstructions: currentListing?.pickupInstructions || '',
      dropoffLocationId: currentListing?.dropoffLocationId || '',
      dropoffInstructions: currentListing?.dropoffInstructions || '',
      startAt: currentListing?.startAt || '',
      endAt: currentListing?.endAt || '',
      alwaysAvailable: currentListing?.alwaysAvailable || false,
      pricePerIntervalCents: currentListing?.pricePerIntervalCents / 100 || '',
      priceInterval: currentListing?.priceInterval || 'daily',
      genericQuantity: currentListing?.genericQuantity || 0,
      assetType: currentListing?.assetType || '',
      bodyType: currentListing?.bodyType || ''
    },
    validationSchema: NewListingSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setErrors }) => {
      try {
        // create title for listing
        const prettyAssetType = `${capitalCase(values.assetType.replace(/_/g, ' '))}${
          values.genericQuantity > 1 ? 's' : ''
        }`;
        const prettyBodyType = capitalCase(values.bodyType.replace(/_/g, ' '));
        const newTitle = `${prettyAssetType} - ${prettyBodyType}`;
        // only send assetIds
        const assetIds = [];
        if (isEdit) {
          myAssets.map((asset, index) => index < values.genericQuantity && assetIds.push(asset.id));
        }
        // set the new values, multiply pricePerIntervalCents * 100
        values = {
          ...values,
          title: newTitle,
          startAt: values.startAt ? new Date(values.startAt) : null,
          endAt: values.endAt ? new Date(values.endAt) : null,
          pricePerIntervalCents: values.pricePerIntervalCents * 100,
          status: !isEdit ? 'open' : currentListing.status,
          assetIds: !isEdit ? [] : assetIds
        };
        if (!isEdit) {
          await dispatch(addListing(getAccessTokenSilently, idToken, values));
        } else {
          await dispatch(editListing(getAccessTokenSilently, idToken, values, currentListing.id));
        }
        resetForm();
        setSubmitting(false);
        enqueueSnackbar(!isEdit ? 'Listing created!' : 'Listing updated!', { variant: 'success' });
        dispatch(getMyListings(getAccessTokenSilently, idToken));
        navigate(PATH_DASHBOARD.listings.root);
      } catch (error) {
        console.error(error);
        setSubmitting(false);
        setErrors(error);
      }
    }
  });

  const { errors, values, touched, handleSubmit, isSubmitting, setFieldValue, getFieldProps } = formik;

  const setAvailableAssets = useCallback(
    (bodyType, pickupId) => {
      const assetsAvailable = myAssets.filter(
        (asset) => asset.homeLocationId === pickupId && bodyType === asset.bodyType
      );
      setNumberAvailable(assetsAvailable.length);
      if (assetsAvailable.length === 0) {
        setFieldValue('genericQuantity', 0);
      }
    },
    [setNumberAvailable, myAssets, setFieldValue]
  );

  useEffect(() => {
    if (currentListing?.assetType !== '' && currentListing?.bodyType !== '') {
      if (currentListing?.pickupLocationId !== '' && numberAvailable === 0) {
        setAvailableAssets(currentListing?.bodyType, currentListing?.pickupLocationId);
      }
    }
  }, [currentListing, numberAvailable, setAvailableAssets]);

  const matchedAssets = myAssets.filter((asset) => asset.homeLocationId === values.pickupLocationId);
  const availableTrucks = [];
  const availableTractors = [];
  const availableTrailers = [];

  const handleGetQuantityAvailable = (event) => {
    setAvailableAssets(event.target.value, values.pickupLocationId);
    setFieldValue('bodyType', event.target.value);
  };

  const handleChangePickup = (event) => {
    setFieldValue('pickupLocationId', event.target.value);
    if (values.bodyType !== '') {
      setAvailableAssets(values.bodyType, event.target.value);
    }
  };

  const handleClosePickUp = () => {
    setOpenPickUp(false);
  };

  const handleCloseDropOff = () => {
    setOpenDropOff(false);
  };

  const handleCreateLocationPickUp = () => {
    dispatch(getAllLocations(getAccessTokenSilently, idToken));
    setFieldValue('pickupLocationId', '');
    handleClosePickUp();
  };

  const handleCreateLocationDropOff = () => {
    dispatch(getAllLocations(getAccessTokenSilently, idToken));
    setFieldValue('dropoffLocationId', '');
    handleCloseDropOff();
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <FormikProvider value={formik}>
      <Form noValidate autoComplete="off" onSubmit={handleSubmit}>
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={10} lg={8}>
            <Card sx={{ p: 3 }}>
              <FormControl fullWidth>
                <InputLabel>Pick Up Location*</InputLabel>
                <Select
                  label="Pick Up Location*"
                  {...getFieldProps('pickupLocationId')}
                  onChange={handleChangePickup}
                  value={values.pickupLocationId}
                  error={Boolean(touched.pickupLocationId && errors.pickupLocationId)}
                >
                  {locations?.map((location) => (
                    <MenuItem key={location.id} value={location.id}>
                      {location.name}:
                      <br />
                      {location.address1},{location.address2 ? ` ${location.address2},` : ''} {location.city},{' '}
                      {location.state} {location.zip}
                    </MenuItem>
                  ))}
                </Select>
                {touched.pickupLocationId && errors.pickupLocationId && (
                  <FormHelperText error>{touched.pickupLocationId && errors.pickupLocationId}</FormHelperText>
                )}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    // need to figure out why the adding a location in the dialog is causing a memory leak
                    // onClick={handleClickOpenPickUp}
                    onClick={() => navigate(PATH_DASHBOARD.locations.new)}
                    startIcon={<Icon icon={plusFill} />}
                    sx={{ mt: 2 }}
                  >
                    Add new location
                  </Button>
                </Box>
                <LocationNewAddressForm
                  open={openPickUp}
                  onClose={handleClosePickUp}
                  onNextStep={handleClosePickUp}
                  onCreateLocation={handleCreateLocationPickUp}
                />
              </FormControl>
              {values.pickupLocationId !== '' && (
                <>
                  {/* eslint-disable-next-line array-callback-return */}
                  {matchedAssets.map((asset) => {
                    if (asset.assetType === 'truck') {
                      availableTrucks.push(asset);
                    } else if (asset.assetType === 'tractor') {
                      availableTractors.push(asset);
                    } else if (asset.assetType === 'trailer') {
                      availableTrailers.push(asset);
                    }
                  })}
                  <Divider sx={{ my: 3 }} />
                  <LabelStyle sx={{ mt: 2 }}>Asset Type*</LabelStyle>
                  <Stack spacing={3}>
                    {isEdit && (
                      <Typography variant="caption">
                        {currentListing?.genericQuantity} {currentListing?.title}
                      </Typography>
                    )}
                    <FormControl fullWidth>
                      <RadioGroup {...getFieldProps('assetType')} row>
                        <Stack spacing={1} direction="column">
                          {ASSET_TYPES.map((asset) => (
                            <Box component="span" key={asset.value}>
                              {asset.value === 'truck' && (
                                <FormControlLabel
                                  key={asset.value}
                                  value={asset.value}
                                  control={<Radio onChange={() => setFieldValue('bodyType', '')} />}
                                  label={`${asset.display}  (${availableTrucks.length} available)`}
                                  sx={{ m: 0 }}
                                />
                              )}
                              {asset.value === 'tractor' && (
                                <FormControlLabel
                                  key={asset.value}
                                  value={asset.value}
                                  control={<Radio onChange={() => setFieldValue('bodyType', '')} />}
                                  label={`${asset.display}  (${availableTractors.length} available)`}
                                  sx={{ m: 0 }}
                                />
                              )}
                              {asset.value === 'trailer' && (
                                <FormControlLabel
                                  key={asset.value}
                                  value={asset.value}
                                  control={<Radio onChange={() => setFieldValue('bodyType', '')} />}
                                  label={`${asset.display}  (${availableTrailers.length} available)`}
                                  sx={{ m: 0 }}
                                />
                              )}
                            </Box>
                          ))}
                        </Stack>
                      </RadioGroup>
                    </FormControl>

                    {values.assetType !== '' && (
                      <FormControl fullWidth>
                        <InputLabel>Body Type*</InputLabel>
                        <Select
                          label="Body Type"
                          {...getFieldProps('bodyType')}
                          onChange={handleGetQuantityAvailable}
                          value={values.bodyType}
                          error={Boolean(touched.bodyType && errors.bodyType)}
                        >
                          {values.assetType === 'truck' &&
                            TRUCK_BODY_TYPES.map((bodyType) => (
                              <MenuItem key={bodyType.value} value={bodyType.value}>
                                {bodyType.display}
                              </MenuItem>
                            ))}
                          {values.assetType === 'tractor' &&
                            TRACTOR_BODY_TYPES.map((bodyType) => (
                              <MenuItem key={bodyType.value} value={bodyType.value}>
                                {bodyType.display}
                              </MenuItem>
                            ))}
                          {values.assetType === 'trailer' &&
                            TRAILER_BODY_TYPES.map((bodyType) => (
                              <MenuItem key={bodyType.value} value={bodyType.value}>
                                {bodyType.display}
                              </MenuItem>
                            ))}
                        </Select>
                      </FormControl>
                    )}
                    {values.bodyType !== '' && (
                      <>
                        <FormControl fullWidth>
                          <InputLabel>Quantity*</InputLabel>
                          <Select
                            label="Quantity*"
                            {...getFieldProps('genericQuantity')}
                            value={numberAvailable < values.genericQuantity ? 0 : values.genericQuantity}
                            error={Boolean(touched.genericQuantity && errors.genericQuantity)}
                          >
                            {numberAvailable > 0 && <MenuItem value={0}>0</MenuItem>}
                            {numberAvailable > 0 &&
                              [...Array(numberAvailable)].map((_, index) => (
                                <MenuItem key={index} value={index + 1}>
                                  {index + 1}
                                </MenuItem>
                              ))}
                            {numberAvailable === 0 && (
                              <MenuItem disabled value={0}>
                                0
                              </MenuItem>
                            )}
                          </Select>
                          {touched.genericQuantity && errors.genericQuantity && (
                            <FormHelperText error>{touched.genericQuantity && errors.genericQuantity}</FormHelperText>
                          )}
                        </FormControl>
                      </>
                    )}
                    {values.genericQuantity > 0 && (
                      <TextField
                        fullWidth
                        placeholder="0.00"
                        label="Daily Price*"
                        {...getFieldProps('pricePerIntervalCents')}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">$</InputAdornment>,
                          type: 'number'
                        }}
                        error={Boolean(touched.pricePerIntervalCents && errors.pricePerIntervalCents)}
                        helperText="Daily price per asset"
                        onWheel={(event) => {
                          event.target.blur();
                        }}
                        sx={{ mt: 3 }}
                      />
                    )}
                  </Stack>
                </>
              )}
            </Card>

            {values.genericQuantity > 0 && (
              <Card sx={{ p: 3, mt: 4 }}>
                <Stack spacing={3}>
                  <div>
                    <LabelStyle sx={(errors.startAt || errors.endAt) && { color: theme.palette.error.main }}>
                      Dates Available*
                    </LabelStyle>
                    <MHidden width="smUp">
                      <MobileDateRangePicker
                        disablePast
                        value={startEndDates}
                        onChange={(newDates) => {
                          setStartEndDates(newDates);
                          setFieldValue('startAt', newDates[0]);
                          setFieldValue('endAt', newDates[1]);
                        }}
                        disabled={values.alwaysAvailable}
                        renderInput={(startProps, endProps) => (
                          <>
                            <TextField
                              {...startProps}
                              error={Boolean(touched.startAt && errors.startAt)}
                              helperText={touched.startAt && errors.startAt}
                            />
                            <Box sx={{ mx: 2 }}> to </Box>
                            <TextField
                              {...endProps}
                              error={Boolean(touched.endAt && errors.endAt)}
                              helperText={touched.endAt && errors.endAt}
                            />
                          </>
                        )}
                      />
                    </MHidden>

                    <MHidden width="smDown">
                      <DesktopDateRangePicker
                        disablePast
                        value={startEndDates}
                        onChange={(newDates) => {
                          setStartEndDates(newDates);
                          setFieldValue('startAt', newDates[0]);
                          setFieldValue('endAt', newDates[1]);
                        }}
                        disabled={values.alwaysAvailable}
                        renderInput={(startProps, endProps) => (
                          <>
                            <TextField
                              {...startProps}
                              fullWidth
                              error={Boolean(touched.startAt && errors.startAt)}
                              helperText={touched.startAt && errors.startAt}
                            />
                            <Box sx={{ mx: 2 }}> to </Box>
                            <TextField
                              {...endProps}
                              fullWidth
                              error={Boolean(touched.endAt && errors.endAt)}
                              helperText={touched.endAt && errors.endAt}
                            />
                          </>
                        )}
                      />
                    </MHidden>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={values.alwaysAvailable}
                          onChange={() => setFieldValue('alwaysAvailable', !values.alwaysAvailable)}
                        />
                      }
                      label="This listing is always available"
                    />
                  </div>

                  <div>
                    <LabelStyle>Pick Up Instructions</LabelStyle>
                    <TextField
                      fullWidth
                      label=""
                      {...getFieldProps('pickupInstructions')}
                      error={Boolean(touched.pickupInstructions && errors.pickupInstructions)}
                      helperText={touched.pickupInstructions && errors.pickupInstructions}
                      multiline
                      rows={2}
                    />
                  </div>

                  <FormControl fullWidth>
                    <InputLabel>Drop Off Location*</InputLabel>
                    <Select
                      label="Drop Off Location*"
                      {...getFieldProps('dropoffLocationId')}
                      value={values.dropoffLocationId}
                      error={Boolean(touched.dropoffLocationId && errors.dropoffLocationId)}
                    >
                      {locations?.map((location) => (
                        <MenuItem key={location.id} value={location.id}>
                          {location.name}:
                          <br />
                          {location.address1},{location.address2 ? ` ${location.address2},` : ''} {location.city},{' '}
                          {location.state} {location.zip}
                        </MenuItem>
                      ))}
                    </Select>
                    {touched.dropoffLocationId && errors.dropoffLocationId && (
                      <FormHelperText error>{touched.dropoffLocationId && errors.dropoffLocationId}</FormHelperText>
                    )}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Button
                        size="small"
                        // need to figure out why the adding a location in the dialog is causing a memory leak
                        // onClick={handleClickOpenPickUp}
                        onClick={() => navigate(PATH_DASHBOARD.locations.new)}
                        startIcon={<Icon icon={plusFill} />}
                        // change this once we have fixed the memory leak issue
                        sx={{ mt: 2, display: 'none' }}
                      >
                        Add new location
                      </Button>
                    </Box>
                    <LocationNewAddressForm
                      open={openDropOff}
                      onClose={handleCloseDropOff}
                      onNextStep={handleCloseDropOff}
                      onCreateLocation={handleCreateLocationDropOff}
                    />
                  </FormControl>

                  <div>
                    <LabelStyle>Drop-Off Instructions</LabelStyle>
                    <TextField
                      fullWidth
                      label=""
                      {...getFieldProps('dropoffInstructions')}
                      error={Boolean(touched.dropoffInstructions && errors.dropoffInstructions)}
                      helperText={touched.dropoffInstructions && errors.dropoffInstructions}
                      multiline
                      rows={2}
                    />
                  </div>

                  <div>
                    <LabelStyle>Other Details</LabelStyle>
                    <TextField
                      fullWidth
                      label=""
                      {...getFieldProps('description')}
                      error={Boolean(touched.description && errors.description)}
                      helperText={touched.description && errors.description}
                      multiline
                      rows={4}
                    />
                  </div>
                </Stack>
              </Card>
            )}
            <LoadingButton
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              loading={isSubmitting}
              disabled={values.genericQuantity === 0}
              sx={{ mt: 4 }}
            >
              {!isEdit ? 'Create Listing' : 'Save Changes'}
            </LoadingButton>
          </Grid>
        </Grid>
      </Form>
    </FormikProvider>
  );
}
