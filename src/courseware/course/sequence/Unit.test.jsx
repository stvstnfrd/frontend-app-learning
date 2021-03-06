import React from 'react';
import { Factory } from 'rosie';
import {
  initializeTestStore, loadUnit, messageEvent, render, screen, waitFor,
} from '../../../setupTest';
import Unit from './Unit';

describe('Unit', () => {
  let mockData;
  const courseMetadata = Factory.build(
    'courseMetadata',
    { content_type_gating_enabled: true },
  );
  const unitBlocks = [Factory.build(
    'block',
    { type: 'problem' },
    { courseId: courseMetadata.id },
  ), Factory.build(
    'block',
    { type: 'vertical', contains_content_type_gated_content: true, bookmarked: true },
    { courseId: courseMetadata.id },
  )];
  const [unit, unitThatContainsGatedContent] = unitBlocks;

  beforeAll(async () => {
    await initializeTestStore({ courseMetadata, unitBlocks });
    mockData = {
      id: unit.id,
      courseId: courseMetadata.id,
      format: 'Homework',
    };
  });

  it('renders correctly', () => {
    render(<Unit {...mockData} />);

    expect(screen.getByText('Loading learning sequence...')).toBeInTheDocument();
    const renderedUnit = screen.getByTitle(unit.display_name);
    expect(renderedUnit).toHaveAttribute('height', String(0));
    expect(renderedUnit).toHaveAttribute(
      'src', `http://localhost:18000/xblock/${mockData.id}?show_title=0&show_bookmark_button=0&recheck_access=1&view=student_view&format=${mockData.format}`,
    );
  });

  it('renders proper message for gated content', () => {
    render(<Unit {...mockData} id={unitThatContainsGatedContent.id} />);

    expect(screen.getByText('Loading learning sequence...')).toBeInTheDocument();
    expect(screen.getByText('Loading locked content messaging...')).toBeInTheDocument();
  });

  it('handles receiving MessageEvent', async () => {
    render(<Unit {...mockData} />);
    loadUnit();

    // Loading message is gone now.
    await waitFor(() => expect(screen.queryByText('Loading learning sequence...')).not.toBeInTheDocument());
    // Iframe's height is set via message.
    expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(messageEvent.payload.height));
  });

  it('calls onLoaded after receiving MessageEvent', async () => {
    const onLoaded = jest.fn();
    render(<Unit {...mockData} {...{ onLoaded }} />);
    loadUnit();

    await waitFor(() => expect(onLoaded).toHaveBeenCalledTimes(1));
  });

  it('resizes iframe on second MessageEvent, does not call onLoaded again', async () => {
    const onLoaded = jest.fn();
    // Clone message and set different height.
    const testMessageWithOtherHeight = { ...messageEvent, payload: { height: 200 } };
    render(<Unit {...mockData} {...{ onLoaded }} />);
    loadUnit();

    await waitFor(() => expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(messageEvent.payload.height)));
    window.postMessage(testMessageWithOtherHeight, '*');
    await waitFor(() => expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(testMessageWithOtherHeight.payload.height)));
    expect(onLoaded).toHaveBeenCalledTimes(1);
  });

  it('ignores MessageEvent with unhandled type', async () => {
    // Clone message and set different type.
    const testMessageWithUnhandledType = { ...messageEvent, type: 'wrong type' };
    render(<Unit {...mockData} />);
    window.postMessage(testMessageWithUnhandledType, '*');

    // HACK: We don't have a function we could reliably await here, so this test relies on the timeout of `waitFor`.
    await expect(waitFor(
      () => expect(screen.getByTitle(unit.display_name)).toHaveAttribute('height', String(testMessageWithUnhandledType.payload.height)),
      { timeout: 100 },
    )).rejects.toThrowError(/Expected the element to have attribute/);
  });
});
